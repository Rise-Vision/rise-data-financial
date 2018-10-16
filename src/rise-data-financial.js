/* eslint-disable no-console */

import { PolymerElement } from "@polymer/polymer/polymer-element.js";
import { timeOut } from "@polymer/polymer/lib/utils/async.js";
import { Debouncer } from "@polymer/polymer/lib/utils/debounce.js";
import { database } from "./rise-data-financial-config.js";
import { financialServerConfig } from "./rise-data-financial-config.js";

class RiseDataFinancial extends PolymerElement {

  static get properties() {
    return {
      /**
       * ID of the financial list in Financial Selector.
       */
      financialList: String,

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
      symbol: String,

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
      "_financialReset(financialList, symbol)"
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

  constructor() {
    super();

    this._firebaseConnected = undefined;
    this._instrumentsReceived = false;
    this._connectDebounceJob = null;
    this._initialStart = true;
  }

  ready() {
    super.ready();

    console.log( "financialServerConfig", financialServerConfig );

    const display_id = RisePlayerConfiguration.getDisplayId();

    if ( display_id && typeof display_id === "string" && display_id !== "DISPLAY_ID" ) {
      this._setDisplayId( display_id );
    }
  }

  connectedCallback() {
    super.connectedCallback();

    this._connectedRef = database.ref( ".info/connected" );
    this._handleConnected = this._handleConnected.bind( this );
    this._connectedRef.on( "value", this._handleConnected );

    this.addEventListener( RiseDataFinancial.EVENT_START, this._handleStart );
  }

  disconnectedCallback() {
    super.disconnectedCallback();

    this._connectedRef.off( "value", this._handleConnected );
    this._instrumentsRef.off( "value", this._handleInstruments );

    this.removeEventListener( RiseDataFinancial.EVENT_START, this._handleStart );
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

  _getData( props, instruments, fields ) {
    if ( !this._isValidType( props.type ) || !this._isValidDuration( props.duration, props.type )) {
      return;
    }

    console.log( "_getData", instruments, fields );

    // TODO: configure JSONP request
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
