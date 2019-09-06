/* eslint-disable no-console */

import { html } from "@polymer/polymer";
import { RiseElement } from "rise-common-component/src/rise-element.js";
import { CacheMixin } from "rise-common-component/src/cache-mixin.js";
import { timeOut } from "@polymer/polymer/lib/utils/async.js";
import { Debouncer } from "@polymer/polymer/lib/utils/debounce.js";
import { financialServerConfig } from "./rise-data-financial-config.js";
import { version } from "./rise-data-financial-version.js";
import "@polymer/iron-jsonp-library/iron-jsonp-library.js";

class RiseDataFinancial extends CacheMixin( RiseElement ) {

  static get template() {
    return html`
      <iron-jsonp-library
            id="financial"
            notify-event="financial-data"
            library-error-message="{{financialErrorMessage}}">
        </iron-jsonp-library>
    `;
  }

  static get properties() {
    return {
      /**
       * List of symbol values separated by "|" to fetch data for
       */
      symbols: {
        type: String,
        value: ""
      },

      /**
       * The list of instruments fields the component should return data for
       */
      instrumentFields: {
        type: Array,
        value: () => {
          return [];
        }
      },

      /**
       * Type of data to fetch, either "realtime" or "historical".
       */
      type: {
        type: String,
        value: "realtime"
      },

      /**
       * Interval for which data should be retrieved.
       * Valid values are: Day, Week, 1M, 3M, 6M, 1Y, 5Y.
       */
      duration: {
        type: String,
        value: "1M"
      },

      /**
       * The id of the display running this instance of the component.
       */
      displayId: {
        type: String,
        readOnly: true,
        value: "preview"
      }
    }
  }

  // Each item of observers array is a method name followed by
  // a comma-separated list of one or more dependencies.
  static get observers() {
    return [
      "_reset(symbols, instrumentFields)",
      "_handleError(financialErrorMessage)"
    ]
  }

  // Event name constants
  static get EVENT_DATA_UPDATE() {
    return "data-update";
  }
  static get EVENT_DATA_CACHE() {
    return "data-cache";
  }
  static get EVENT_DATA_ERROR() {
    return "data-error";
  }
  static get EVENT_REQUEST_ERROR() {
    return "request-error";
  }
  static get EVENT_CLIENT_OFFLINE() {
    return "client-offline"
  }

  static get ERROR_EVENTS() {
    return {
      "N/P": {
        message: "Rise is not permissioned to show the instrument",
        level: "warning"
      },
      "N/A": {
        message: "Instrument is unavailable, invalid or unknown",
        level: "error"
      },
      "S/P": {
        message: "Display is not permissioned to show the instrument",
        level: "error"
      }
    };
  }

  static get LOG_AT_MOST_ONCE_PER_DAY() {
    return {
      _logAtMostOncePerDay: true
    };
  }

  static get TIMING_CONFIG() {
    return {
      refresh: 1000 * 60,
      retry: 1000 * 60,
      cooldown: 1000 * 60 * 10
    }
  }

  constructor() {
    super();

    this._setVersion( version );

    this._refreshDebounceJob = null;
    this._initialStart = true;
    this._financialRequestRetryCount = 0;
    this._userConfigChange = false;
    this._url = "";
    this._cacheKey = "";
    this._cachedEvent = null;
  }

  connectedCallback() {
    super.connectedCallback();

    this._handleData = this._handleData.bind( this );
    this.$.financial.addEventListener( "financial-data", this._handleData );
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this.$.financial.removeEventListener( "financial-data", this._handleData );
  }

  _log( type, event, details = null, additionalFields ) {
    super.log( type, event, details, additionalFields );
  }

  _reset() {
    if ( !this._initialStart ) {
      this._userConfigChange = true;
      this._refreshDebounceJob && this._refreshDebounceJob.cancel();

      this._log( "info", "reset", {
        symbols: this.symbols,
        instrumentFields: this.instrumentFields
      }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );

      this._getData( this.symbols,
        {
          type: this.type,
          duration: this.duration,
        },
        this.instrumentFields
      );
    }
  }

  _sendFinancialEvent( eventName, detail = {}) {
    super._sendEvent( eventName, detail );

    switch ( eventName ) {
    case RiseDataFinancial.EVENT_REQUEST_ERROR:
    case RiseDataFinancial.EVENT_DATA_ERROR:
      super._setUptimeError( true );
      break;
    case RiseDataFinancial.EVENT_DATA_UPDATE:
      super._setUptimeError( false );
      break;
    default:
    }
  }

  _sendEmptyDataEvent() {
    this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_UPDATE, {
      "user-config-change": this._userConfigChange,
      "data": { rows: null }
    });
  }

  _isValidSymbols( symbols ) {
    if ( typeof symbols !== "string" || symbols === "" ) {
      return false;
    }

    // single symbol
    if ( symbols.indexOf( "|" ) === -1 ) {
      return true;
    }

    return symbols.split( "|" ).indexOf( "" ) === -1;
  }

  _isValidType( type ) {
    return type === "realtime" || type === "historical";
  }

  _isValidDuration( duration, type ) {
    if ( type.toLowerCase() === "historical" ) {
      // Parameters passed to financial server are case sensitive.
      return [ "Day", "Week", "1M", "3M", "6M", "1Y", "5Y" ].indexOf( duration ) !== -1;
    } else {
      return true;
    }
  }

  _processError( isOffline ) {
    if ( this._financialRequestRetryCount === 0 ) {
      this._cachedEvent && this._handleData( this._cachedEvent );
    }

    if ( this._financialRequestRetryCount < 5 ) {
      this._financialRequestRetryCount += 1;

      // need to reset to null otherwise financialErrorMessage value may not change from next request failure
      // and therefore observer won't trigger this handler
      this.financialErrorMessage = null;

      timeOut.run(() => {
        this._getData( this.symbols,
          {
            type: this.type,
            duration: this.duration
          },
          this.instrumentFields
        );
      }, RiseDataFinancial.TIMING_CONFIG.retry );
    } else {
      this._financialRequestRetryCount = 0;
      if ( isOffline ) {
        this._log( "error", RiseDataFinancial.EVENT_CLIENT_OFFLINE, { message: this.financialErrorMessage });
      } else {
        this._log( "error", RiseDataFinancial.EVENT_REQUEST_ERROR, { message: this.financialErrorMessage });
        this._sendFinancialEvent( RiseDataFinancial.EVENT_REQUEST_ERROR, { message: this.financialErrorMessage });
      }

      this._refresh( RiseDataFinancial.TIMING_CONFIG.cooldown );
    }
  }

  _handleError() {
    if ( !this._initialStart && this.financialErrorMessage ) {
      super.isOffline().then( isOffline => this._processError( isOffline ));
    }
  }

  _handleData( event ) {
    if ( !event.detail || !event.detail.length ) {
      return;
    }

    const detail = event.detail [ 0 ],
      cached = event.cached || false;

    this._financialRequestRetryCount = 0;

    if ( detail.hasOwnProperty( "errors" ) && detail.errors.length === 1 ) {
      this._log( "error", RiseDataFinancial.EVENT_DATA_ERROR, { error: detail.errors[ 0 ], cached });
      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_ERROR, detail.errors[ 0 ]);
    } else {
      let data = {
        "user-config-change": this._userConfigChange
      };

      this._userConfigChange = false;

      if ( detail.hasOwnProperty( "table" ) && detail.table ) {
        data.data = detail.table;
      }

      // Just log these entries once per day, as they may consume lots of log space.
      this._log( "info", RiseDataFinancial.EVENT_DATA_UPDATE, Object.assign({}, data, { cached }), RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );

      this._checkFinancialErrors( data, cached );

      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_UPDATE, data );

      if ( !cached ) {
        const options = {
          headers: {
            "Date": new Date(),
            "content-type": "application/json"
          }
        };

        // Just log these entries once per day, as they may consume lots of log space.
        this._log( "info", RiseDataFinancial.EVENT_DATA_CACHE, { key: this._cacheKey, event }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );

        super.putCache && super.putCache( new Response( JSON.stringify( event ), options ), this._cacheKey );
      }
    }

    this._refresh( RiseDataFinancial.TIMING_CONFIG.refresh );
  }

  _checkFinancialErrors( data, cached ) {
    Object.keys( RiseDataFinancial.ERROR_EVENTS )
      .forEach( status => {
        if ( data.data && data.data.rows && data.data.rows.some( row =>
          row.c && row.c.some( cell => cell.v === status )
        )) {
          const error = RiseDataFinancial.ERROR_EVENTS[ status ];

          this._log( error.level, `${ error.message }`, {
            symbols: this.symbols, cached
          }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );
        }
      });
  }

  _getQueryString( fields ) {
    if ( fields.length === 0 ) {
      return "";
    }

    return `select ${ fields.join( "," ) }`;
  }

  _getParams( fields, symbols, callback ) {

    return Object.assign({},
      {
        id: this.displayId,
        code: symbols,
        tqx: `out:json;responseHandler:${callback}`
      },
      fields.length > 0 ? { tq: this._getQueryString( fields ) } : null );
  }

  _getKey() {
    return `risedatafinancial_${this.type}_${this.displayId}_${this.symbols}_${this.duration}`;
  }

  _getCacheKey() {
    const fields = this.instrumentFields.length > 0 ? this.instrumentFields.join( "," ) : "";

    return `${this._getKey()}_${fields}`;
  }

  _getCallbackValue( key ) {
    return ( btoa(( this.id ? this.id : "" ) + key )).substr( 0, 10 ) + ( Math.random().toString()).substring( 2 );
  }

  _getSerializedUrl( url, params ) {
    const queryParams = Object.keys( params ).reduce(( arr, key ) => {
      return arr.push( key + "=" + encodeURIComponent( params[ key ])) && arr;
    }, []).join( "&" );

    return `${url}?${queryParams}`;
  }

  _tryGetCache( url ) {
    if ( super.getCache ) {
      return super.getCache( url );
    } else {
      return Promise.reject();
    }
  }

  _requestData( cachedEvent ) {
    const financial = this.$.financial;

    this._cachedEvent = cachedEvent;

    financial.libraryUrl = this._url;
  }

  _dateReviver( key, value ) {
    const reISO = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d*))(?:Z|(\+|-)([\d|:]*))?$/;

    if ( typeof value === "string" ) {
      let a = reISO.exec( value );

      if ( a ) {
        return new Date( value );
      }
    }

    return value;
  }

  _handleParseError( event, err, resp ) {
    this._log( "error", event, { err, resp }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );
  }

  _processValidCacheResponse( resp ) {
    if ( resp && resp.text ) {
      resp.text().then( event => {
        try {
          const parsed = JSON.parse( event, this._dateReviver );

          this._handleData( Object.assign( parsed, { cached: true }));
        } catch ( err ) {
          this._handleParseError( "error parsing text", err );
        }
      })
        .catch( err => this._handleParseError( "error parsing response from valid cache", err, resp ));
    } else {
      this._log( "warning", "empty valid cache response object", { key: this._cacheKey } );
      // ensure a request for the data occurs
      this._processInvalidCacheResponse();
    }

  }

  _processInvalidCacheResponse( resp ) {
    if ( resp && resp.text ) {
      resp.text().then( event => {
        try {
          const parsed = JSON.parse( event, this._dateReviver );

          this._requestData( Object.assign( parsed, { cached: true }));
        } catch ( err ) {
          this._handleParseError( "error parsing text", err );
        }
      })
        .catch( err => this._handleParseError( "error parsing response from expired/invalid cache", err, resp ));
    } else {
      if ( resp && !resp.text ) {
        this._log( "warning", "empty expired cache response object", { key: this._cacheKey } );
      }

      this._requestData( null );
    }
  }

  _getData( symbols, props, fields ) {
    if ( !this._isValidType( props.type ) || !this._isValidDuration( props.duration, props.type )) {
      this._log( "error", "Invalid attributes", { props }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );

      this._sendEmptyDataEvent();
      this._refresh( RiseDataFinancial.TIMING_CONFIG.refresh );

      return;
    }

    if ( !this._isValidSymbols( symbols )) {
      if ( symbols !== "" ) {
        this._log( "error", "Invalid attributes", { symbols }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );
      }

      this._sendEmptyDataEvent();
      this._refresh( RiseDataFinancial.TIMING_CONFIG.refresh );

      return;
    }

    // set callback with the same value it was set on the responseHandler of the tqx parameter
    const financial = this.$.financial,
      callbackValue = this._getCallbackValue( this._getKey());

    let params = this._getParams( fields, symbols, callbackValue ),
      url;

    if ( props.type === "realtime" ) {
      url = this._getSerializedUrl( financialServerConfig.realTimeURL, params );
    } else {
      params.kind = props.duration;
      url = this._getSerializedUrl( financialServerConfig.historicalURL, params );
    }

    financial.callbackName = callbackValue;
    this._url = url;
    this._cacheKey = this._getCacheKey();

    return this._tryGetCache( this._cacheKey )
      .then( resp => this._processValidCacheResponse( resp ))
      .catch(( cachedResp ) => this._processInvalidCacheResponse( cachedResp ));
  }

  _refresh( interval ) {
    if ( !this._refreshDebounceJob || !this._refreshDebounceJob.isActive()) {
      this._refreshDebounceJob = Debouncer.debounce( this._refreshDebounceJob, timeOut.after( interval ), () => {
        this._getData( this.symbols,
          {
            type: this.type,
            duration: this.duration,
          },
          this.instrumentFields
        );
      });
    }
  }

  _configureDisplayId() {
    const display_id = RisePlayerConfiguration.getDisplayId();

    if ( display_id && typeof display_id === "string" && display_id !== "DISPLAY_ID" ) {
      this._setDisplayId( display_id );
    }
  }

  _configureCache() {
    if ( this._isValidType( this.type )) {
      const initObj = {
        name: this.tagName.toLowerCase(),
        expiry: -1
      };

      if ( this.type === "realtime" || ( this.type === "historical" && this.duration.toUpperCase() === "DAY" )) {
        initObj.duration = 1000 * 55;
      } else {
        // set a duration of 24 hours that a cached response is valid for historical data (except when duration is DAY)
        initObj.duration = 1000 * 60 * 60 * 24;
      }

      super.initCache( initObj );
    }
  }

  _handleStart() {
    if ( this._initialStart ) {
      this._initialStart = false;

      this._configureDisplayId();
      this._configureCache();

      // configure and execute request
      this._getData( this.symbols,
        {
          type: this.type,
          duration: this.duration,
        },
        this.instrumentFields
      );
    }
  }

}

customElements.define( "rise-data-financial", RiseDataFinancial );
