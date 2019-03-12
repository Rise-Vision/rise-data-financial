/* eslint-disable no-console */

import { PolymerElement, html } from "@polymer/polymer";
import { timeOut } from "@polymer/polymer/lib/utils/async.js";
import { Debouncer } from "@polymer/polymer/lib/utils/debounce.js";
import { financialServerConfig } from "./rise-data-financial-config.js";
import { version } from "./rise-data-financial-version.js";
import "@polymer/iron-jsonp-library/iron-jsonp-library.js";

class RiseDataFinancial extends PolymerElement {

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
  static get EVENT_CONFIGURED() {
    return "configured";
  }
  static get EVENT_START() {
    return "start";
  }
  static get EVENT_DATA_UPDATE() {
    return "data-update";
  }
  static get EVENT_DATA_ERROR() {
    return "data-error";
  }
  static get EVENT_REQUEST_ERROR() {
    return "request-error";
  }
  static get EVENT_INVALID_SYMBOL() {
    return "invalid-symbol";
  }

  static get ERROR_EVENTS() {
    return {
      "N/P": "Rise is not permissioned to show the instrument",
      "N/A": "Instrument is unavailable, invalid or unknown",
      "S/P": "Display is not permissioned to show the instrument"
    };
  }

  constructor() {
    super();

    this._refreshDebounceJob = null;
    this._initialStart = true;
    this._logDataUpdate = true;
    this._financialRequestRetryCount = 0;
    this._eventsAlreadyLogged = [];
  }

  ready() {
    super.ready();

    if ( RisePlayerConfiguration.isConfigured()) {
      this._init();
    } else {
      const init = () => this._init();

      window.addEventListener( "rise-components-ready", init, { once: true });
    }
  }

  _init() {
    const display_id = RisePlayerConfiguration.getDisplayId();

    if ( display_id && typeof display_id === "string" && display_id !== "DISPLAY_ID" ) {
      this._setDisplayId( display_id );
    }

    this.addEventListener( RiseDataFinancial.EVENT_START, this._handleStart, { once: true });

    this._sendFinancialEvent( RiseDataFinancial.EVENT_CONFIGURED );
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

  _getComponentData() {
    return {
      name: "rise-data-financial",
      id: this.id,
      version: version
    };
  }

  _log( type, event, details = null ) {
    switch ( type ) {
    case "info":
      RisePlayerConfiguration.Logger.info( this._getComponentData(), event, details );
      break;
    case "warning":
      RisePlayerConfiguration.Logger.warning( this._getComponentData(), event, details );
      break;
    case "error":
      RisePlayerConfiguration.Logger.error( this._getComponentData(), event, details );
      break;
    }
  }

  _reset() {
    if ( !this._initialStart ) {
      this._logDataUpdate = true;
      this._refreshDebounceJob && this._refreshDebounceJob.cancel();

      this._log( "info", "reset", {
        symbols: this.symbols,
        instrumentFields: this.instrumentFields
      });

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
    const event = new CustomEvent( eventName, {
      bubbles: true, composed: true, detail
    });

    this.dispatchEvent( event );
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
      let data = {};

      if ( detail.hasOwnProperty( "table" ) && detail.table ) {
        data.data = detail.table;
      }

      if ( this._logDataUpdate ) {
        // due to refresh every 60 seconds, prevent logging data-update event to BQ every time
        this._logDataUpdate = false;

        this._log( "info", RiseDataFinancial.EVENT_DATA_UPDATE, data );
      }

      this._checkFinancialErrors( data );

      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_UPDATE, data );
    }

    this._refresh();
  }

  _checkFinancialErrors( data ) {
    Object.keys( RiseDataFinancial.ERROR_EVENTS )
      .filter( status => !this._eventsAlreadyLogged.includes( status ))
      .forEach( status => {
        if ( data.data && data.data.rows && data.data.rows.some( row =>
          row.c && row.c.some( cell => cell.v === status )
        )) {
          const errorMessage = RiseDataFinancial.ERROR_EVENTS[ status ];

          this._log( "error", `${ errorMessage }`, { symbols: this.symbols });

          // due to refresh every 60 seconds, prevent logging same error event to BQ every time
          this._eventsAlreadyLogged.push( status );
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
    if ( !this._isValidSymbols( symbols ) || !this._isValidType( props.type ) || !this._isValidDuration( props.duration, props.type )) {
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
