/* eslint-disable no-console */

import { html } from "@polymer/polymer";
import { RiseElement } from "rise-common-component/src/rise-element.js";
import { timeOut } from "@polymer/polymer/lib/utils/async.js";
import { Debouncer } from "@polymer/polymer/lib/utils/debounce.js";
import { financialServerConfig } from "./rise-data-financial-config.js";
import { version } from "./rise-data-financial-version.js";
import "@polymer/iron-jsonp-library/iron-jsonp-library.js";

class RiseDataFinancial extends RiseElement {

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
  static get EVENT_DATA_ERROR() {
    return "data-error";
  }
  static get EVENT_REQUEST_ERROR() {
    return "request-error";
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

  constructor() {
    super();

    this._setVersion( version );

    this._refreshDebounceJob = null;
    this._initialStart = true;
    this._financialRequestRetryCount = 0;
    this._userConfigChange = false;
  }

  _init() {
    super._init();

    const display_id = RisePlayerConfiguration.getDisplayId();

    if ( display_id && typeof display_id === "string" && display_id !== "DISPLAY_ID" ) {
      this._setDisplayId( display_id );
    }
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

  _handleError() {
    if ( !this._initialStart && this.financialErrorMessage ) {
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
        }, 1000 );
      } else {
        this._financialRequestRetryCount = 0;
        this._log( "error", RiseDataFinancial.EVENT_REQUEST_ERROR, { message: this.financialErrorMessage });
        this._sendFinancialEvent( RiseDataFinancial.EVENT_REQUEST_ERROR, { message: this.financialErrorMessage });
        this._refresh();
      }
    }
  }

  _handleData( event ) {
    if ( !event.detail || !event.detail.length ) {
      return;
    }

    const detail = event.detail [ 0 ];

    this._financialRequestRetryCount = 0;

    if ( detail.hasOwnProperty( "errors" ) && detail.errors.length === 1 ) {
      this._log( "error", RiseDataFinancial.EVENT_DATA_ERROR, { error: detail.errors[ 0 ] });
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
      this._log( "info", RiseDataFinancial.EVENT_DATA_UPDATE, data, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );

      this._checkFinancialErrors( data );

      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_UPDATE, data );
    }

    this._refresh();
  }

  _checkFinancialErrors( data ) {
    Object.keys( RiseDataFinancial.ERROR_EVENTS )
      .forEach( status => {
        if ( data.data && data.data.rows && data.data.rows.some( row =>
          row.c && row.c.some( cell => cell.v === status )
        )) {
          const error = RiseDataFinancial.ERROR_EVENTS[ status ];

          this._log( error.level, `${ error.message }`, {
            symbols: this.symbols
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

  _getCallbackValue( key ) {
    return ( btoa(( this.id ? this.id : "" ) + key )).substr( 0, 10 ) + ( Math.random().toString()).substring( 2 );
  }

  _getSerializedUrl( url, params ) {
    const queryParams = Object.keys( params ).reduce(( arr, key ) => {
      return arr.push( key + "=" + encodeURIComponent( params[ key ])) && arr;
    }, []).join( "&" );

    return `${url}?${queryParams}`;
  }

  _getData( symbols, props, fields ) {
    if ( !this._isValidType( props.type ) || !this._isValidDuration( props.duration, props.type )) {
      this._log( "error", "Invalid attributes", { props }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );

      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_ERROR, "Invalid attributes." );
      return;
    }

    if ( !this._isValidSymbols( symbols )) {
      if ( symbols !== "" ) {
        this._log( "error", "Invalid attributes", { symbols }, RiseDataFinancial.LOG_AT_MOST_ONCE_PER_DAY );
      }

      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_ERROR, "Invalid attributes." );
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
    financial.libraryUrl = url;
  }

  _refresh() {
    if ( !this._refreshDebounceJob || !this._refreshDebounceJob.isActive()) {
      this._refreshDebounceJob = Debouncer.debounce( this._refreshDebounceJob, timeOut.after( 60000 ), () => {
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

  _handleStart() {
    if ( this._initialStart ) {
      this._initialStart = false;

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
