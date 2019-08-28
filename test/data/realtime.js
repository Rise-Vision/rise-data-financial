/* eslint-disable no-unused-vars */

const realTimeData = {
  sig: "1370849918",
  status: "ok",
  table: {
    cols: [
      { id: "lastPrice", label: "Last Price", pattern: "", type: "number" },
      { id: "netChange", label: "Change", pattern: "", type: "number" },
      { id: "tradeTime", label: "Trade Time", pattern: "", type: "datetime" },
    ],
    rows: [ {
      c: [
        { v: 12.3 },
        { v: 12.3 },
        { v: new Date() },
      ]
    } ]
  },
  version: "0.6"
};
