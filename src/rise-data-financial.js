/* eslint-disable no-console */

import { PolymerElement, html } from "@polymer/polymer";
import { timeOut } from "@polymer/polymer/lib/utils/async.js";
import { Debouncer } from "@polymer/polymer/lib/utils/debounce.js";
import { database } from "./rise-data-financial-config.js";
import { financialServerConfig } from "./rise-data-financial-config.js";
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
       * ID of the financial list in Financial Selector.
       */
      financialList: {
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
       * A single instrument symbol to return data for
       */
      symbol: {
        type: String,
        value: ""
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
      "_financialReset(financialList, symbol)",
      "_handleError(financialErrorMessage)"
    ]
  }

  // Event name constants
  static get EVENT_INSTRUMENTS_RECEIVED() {
    return "instruments-received";
  }
  static get EVENT_INSTRUMENTS_UNAVAILABLE() {
    return "instruments-unavailable";
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

  constructor() {
    super();

    this._firebaseConnected = undefined;
    this._instrumentsReceived = false;
    this._connectDebounceJob = null;
    this._initialStart = true;
    this._invalidSymbol = false;
  }

  ready() {
    super.ready();

    const display_id = RisePlayerConfiguration.getDisplayId();

    if ( display_id && typeof display_id === "string" && display_id !== "DISPLAY_ID" ) {
      this._setDisplayId( display_id );
    }

    // TEMPORARY - listen for event to override displayId value
    this.addEventListener( "override-displayid", ( event ) => {
      this._setDisplayId( event.detail.id );
    });
  }

  connectedCallback() {
    super.connectedCallback();

    this._connectedRef = database.ref( ".info/connected" );
    this._handleConnected = this._handleConnected.bind( this );
    this._connectedRef.on( "value", this._handleConnected );

    this.addEventListener( RiseDataFinancial.EVENT_START, this._handleStart );

    this._handleData = this._handleData.bind( this );
    this.$.financial.addEventListener( "financial-data", this._handleData );
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this._connectedRef.off( "value", this._handleConnected );
    this._instrumentsRef.off( "value", this._handleInstruments );

    this.removeEventListener( RiseDataFinancial.EVENT_START, this._handleStart );
    this.$.financial.removeEventListener( "financial-data", this._handleData );
  }

  _getInstrumentsFromLocalStorage( key ) {
    return new Promise(( resolve, reject ) => {
      try {
        const instruments = JSON.parse( localStorage.getItem( key ));

        resolve( instruments );
      } catch ( e ) {
        console.warn( e.message );
        reject();
      }
    });
  }

  _getInstruments() {
    if ( !this.financialList || this._firebaseConnected === undefined ) {
      return;
    }

    if ( this._firebaseConnected ) {
      this._instrumentsRef = database.ref( `lists/${ this.financialList }/instruments` );
      this._handleInstruments = this._handleInstruments.bind( this );

      this._instrumentsRef.on( "value", this._handleInstruments );
    } else {
      this._getInstrumentsFromLocalStorage( `risedatafinancial_${ this.financialList }` )
        .then(( instruments ) => {
          this._instrumentsReceived = true;
          this._instruments = instruments;

          this._sendFinancialEvent( RiseDataFinancial.EVENT_INSTRUMENTS_RECEIVED, this._instruments );
        })
        .catch(() => this._sendFinancialEvent( RiseDataFinancial.EVENT_INSTRUMENTS_UNAVAILABLE ));
    }
  }

  _saveInstruments( instruments ) {
    try {
      localStorage.setItem( `risedatafinancial_${ this.financialList }`, JSON.stringify( instruments ));
    } catch ( e ) {
      console.warn( e.message );
    }
  }

  _handleConnected( snapshot ) {
    if ( !this._instrumentsReceived ) {
      if ( !snapshot.val()) {
        // account for multiple "false" values being initially returned even though network status is online
        if ( !this._connectDebounceJob || !this._connectDebounceJob.isActive()) {
          this._connectDebounceJob = Debouncer.debounce( this._connectDebounceJob, timeOut.after( 2000 ), () => {
            this._firebaseConnected = false;
            this._getInstruments();
          });
        }
      } else {
        this._connectDebounceJob && this._connectDebounceJob.cancel();
        this._firebaseConnected = true;
        this._getInstruments();
      }
    }
  }

  _handleInstruments( snapshot ) {
    const instruments = snapshot.val() || {};

    this._instruments = this._sortInstruments( instruments );
    this._instrumentsReceived = true;
    this._saveInstruments( this._instruments );

    this._sendFinancialEvent( RiseDataFinancial.EVENT_INSTRUMENTS_RECEIVED, this._instruments );
  }

  _financialReset() {
    this._getInstruments();
  }

  _sendFinancialEvent( eventName, detail = {}) {
    const event = new CustomEvent( eventName, {
      bubbles: true, composed: true, detail
    });

    this.dispatchEvent( event );
  }

  _sortInstruments( instrumentMap ) {
    const list = Object.keys( instrumentMap )
      .map(( $id ) => Object.assign({ $id }, instrumentMap[ $id ]))
      .sort(( i1, i2 ) => this._numberify( i1.order ) - this._numberify( i2.order ));

    return list;
  }

  _numberify( x ) {
    // if number is not defined or is invalid, assign the infinity
    // value to make sure the item stay at the bottom
    return Number.isInteger( x ) ? x : Number.POSITIVE_INFINITY;
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
    this._sendFinancialEvent( RiseDataFinancial.EVENT_REQUEST_ERROR, { message: this.financialErrorMessage });

    //TODO: start a refresh timer
  }

  _handleData( event ) {
    if ( !event.detail || !event.detail.length ) {
      return;
    }

    const detail = event.detail [ 0 ];

    if ( detail.hasOwnProperty( "errors" ) && detail.errors.length === 1 ) {
      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_ERROR, detail.errors[ 0 ]);
    } else {
      let instruments = this._instruments,
        data = {};

      if ( this.symbol && !this._invalidSymbol ) {
        instruments = this._instruments.filter(( obj ) => {
          return obj.symbol === this.symbol;
        });
      }

      data = { instruments: instruments };

      if ( detail.hasOwnProperty( "table" ) && detail.table ) {
        data.data = detail.table;
      }

      this._sendFinancialEvent( RiseDataFinancial.EVENT_DATA_UPDATE, data );
    }

    //TODO: start a refresh timer

  }

  _getSymbols( instruments ) {
    const symbols = instruments.map(({ symbol }) => symbol );

    if ( this.symbol ) {
      if ( symbols.indexOf( this.symbol ) != -1 ) {
        return this.symbol;
      } else {
        this._invalidSymbol = true;
        this._sendFinancialEvent( "invalid-symbol" );

        return "";
      }
    }

    return symbols.join( "|" );
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
    return `risedatafinancial_${this.type}_${this.displayId}_${this.financialList}_${this.duration}_${this.symbol}`;
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

  _getData( props, instruments, fields ) {
    if ( !this._isValidType( props.type ) || !this._isValidDuration( props.duration, props.type )) {
      return;
    }

    const symbols = this._getSymbols( instruments );

    if ( !this._invalidSymbol ) {
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
  }

  _handleStart() {
    if ( !this._instrumentsReceived ) {
      return;
    }

    if ( this._initialStart ) {
      this._initialStart = false;

      // configure and execute request
      this._getData(
        {
          type: this.type,
          duration: this.duration,
        },
        this._instruments,
        this.instrumentFields
      );

    }

  }

}

customElements.define( "rise-data-financial", RiseDataFinancial );
