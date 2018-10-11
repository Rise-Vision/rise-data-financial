/* global firebase */

if ( !firebase.apps.length ) {
  firebase.initializeApp({
    apiKey: "AIzaSyA_tQUKBCYzj_VJwXpRNfna0-btAZe1b-w",
    databaseURL: "https://fir-stage.firebaseio.com",
  });
}

const database = firebase.database(),
  financialServerConfig = {
    realTimeURL: "https://contentfinancial2-test.appspot.com/data",
    historicalURL: "https://contentfinancial2-test.appspot.com/data/historical",
  };

export default firebase;

export {
  database,
  financialServerConfig
};
