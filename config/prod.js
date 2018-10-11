/* global firebase */

if ( !firebase.apps.length ) {
  firebase.initializeApp({
    apiKey: "AIzaSyA8VXZwqhHx4qEtV5BcBNe41r7Ra0ZThfY",
    databaseURL: "https://fir-b3915.firebaseio.com",
  });
}

const database = firebase.database(),
  financialServerConfig = {
    realTimeURL: "https://contentfinancial2.appspot.com/data",
    historicalURL: "https://contentfinancial2.appspot.com/data/historical",
  };

export default firebase;

export {
  database,
  financialServerConfig
};
