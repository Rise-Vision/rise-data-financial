/* eslint-disable no-unused-vars */

let _firebaseConnectionStatus = true,
  fireConnStatusCallback,
  firebase = {
    initializeApp: ( config ) => {
      return config;
    },
    apps: [],
    database: () => {
      return {
        ref: ( path ) => {
          if ( path === ".info/connected" ) {
            return {
              on: ( key, cb ) => {
                if ( key !== "value" ) {
                  return;
                }
                fireConnStatusCallback = cb;
                fireConn();
              },
              off: ( key ) => {
                if ( key !== "value" ) {
                  return;
                }
                fireConnStatusCallback = undefined;
              }
            };
          } else {
            return {
              on: ( key, cb ) => {
                if ( key !== "value" ) {
                  return;
                }

                cb({
                  val: () => {
                    return {
                      "AA?N": {
                        category: "Stocks",
                        index: 0,
                        name: "Alcoa",
                        symbol: "AA.N"
                      }
                    }
                  }
                });
              },
              off: ( key ) => {
                if ( key !== "value" ) {
                  return;
                }

                fireConnStatusCallback = undefined;
              }
            };
          }
        }
      };
    }
  };

function fireConn() {
  fireConnStatusCallback({
    val: () => {
      return _firebaseConnectionStatus;
    }
  })
}

function setFirebaseConnectionStatus( status ) {
  _firebaseConnectionStatus = status;
  fireConn();
}
