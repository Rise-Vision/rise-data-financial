# Financial Data Web Component [![CircleCI](https://circleci.com/gh/Rise-Vision/rise-data-financial/tree/master.svg?style=svg)](https://circleci.com/gh/Rise-Vision/rise-data-financial/tree/master)

## Introduction

`rise-data-financial` is a Polymer 3 Web Component that works together with the [Rise Vision Financial Selector](https://selector.risevision.com/), a web app for managing financial content. It retrieves the financial list and its corresponding instruments from [Firebase](https://firebase.google.com/). Data is refreshed in realtime, so any changes that are made to a particular financial list in the Financial Selector are immediately propagated to the `rise-data-financial` component.

Instructions for demo page here:
https://github.com/Rise-Vision/rise-data-financial/blob/master/demo/README.md

## Usage
The component has an external dependency on [Firebase](https://firebase.google.com/) and has not been built to bundle the required SDK libraries. This means the required Firebase libraries must be explicitly imported in the `<head>` of the HTML page that you are using the component. **_Note_**: The version of Firebase used below is just for example purposes.

```
<html>
  <head>
	...
	<script src="https://www.gstatic.com/firebasejs/5.5.3/firebase-app.js"></script>
    <script src="https://www.gstatic.com/firebasejs/5.5.3/firebase-database.js"></script>
    ...
  </head>
  <body>
    ...
  </body>
</html>
```

The below illustrates simple usage of the component and listening to the `rise-components-loaded` event to initiate. This is required in order to know that the component has been imported to the page. See the demo section in this repo for a full working example of an HTML page using the component which will illustrate required imports in the `<head>` of the page.

### Example

```
  <body>
    <script>
      function onComponentsLoaded( evt ) {
        if ( !evt.detail.isLoaded ) {
          console.log( "load process failed" );
          return;
        }

        const financial = document.querySelector( "rise-data-financial" );

        financial.addEventListener( "instruments-received", () => {
          // instruments have been retrieved, can now dispatch 'start' event to get data
          financial.dispatchEvent(new CustomEvent("start"));
        } );

        financial.addEventListener( "data-update", ( evt ) => {
          // data has been received
          console.log( "data update", evt.detail );
        } );
      }

      window.addEventListener( "rise-components-loaded", onComponentsLoaded);
    </script>

    <rise-data-financial
      id="financial01"
      financial-list="-ABC123DEF456"
      instrument-fields='["instrument", "name", "lastPrice", "netChange"]'>
    </rise-data-financial>
...

  </body>
```
### Realtime Data
To request realtime data, the `type` attribute can either be left off or it can be set to `realtime`.

Valid values for the `instrument-fields` attribute for realtime data are: `accumulatedVolume`, `ask`, `bid`, `code`, `dayHigh`, `dayLow`, `daysOfWeek`, `endTime`, `historicClose`, `instrument`, `lastPrice`, `name`, `netChange`, `percentChange`, `startTime`, `timeZone`, `timeZoneOffset`, `tradeTime`, `updateInterval`, `yearHigh`, `yearLow`, `yield` `logoURL` and `yieldChange`.

If no `instrument-fields` attribute is provided, all fields are returned by default.

#### Example

```
<rise-data-financial
  financial-list="-ABC123DEF456"
  instrument-fields='["instrument", "name"]'>
</rise-data-financial>
```

### Historical Data
To request historical data, the `type` attribute must be set to `historical` and `duration` must be set to one of: `Day`, `Week`, `1M`, `3M`, `6M`, `1Y` or `5Y`.

Valid values for the `instrument-fields` attribute for historical data are: `accumulatedVolume`, `closePrice`, `intervalVolume`, `percentChange` and `tradeTime`.

If no `instrument-fields` attribute is provided, all fields are returned by default.

In case the list of instruments contains more than one instrument an attribute `symbol` can be set to specify which instrument from the list the historical data needs to be retrieved.

#### Example

```
<rise-data-financial
  duration="1M"
  financial-list="-ABC123DEF456"
  instrument-fields='["closePrice", "percentChange"]'
  type="historical"
  symbol="AAPL.O">
</rise-data-financial>
```

### Data Object

When listening for the "data-update" event, the `event.detail` object returned is an object of the following format:

![rise-financial data](https://cloud.githubusercontent.com/assets/1190420/21622351/1b53131c-d1cb-11e6-8ae3-2d1e2fb9049d.png)

_data_ is an object with _cols_ and _rows_ properties, where _cols_ is an array that contains additional information about the requested fields, and _rows_ is an array that contains the actual data.

_instruments_ is an object that provides details about every instrument found in the financial list.

### Attributes

This component receives the following list of attributes:

- **category**: "bonds" / "commodities" / "currencies" / "market statistics" / "stocks" / "world indexes". Required if the component is editable.
- **symbols** ( string ): List of symbols separated by pipe symbol. Required if the component is editable. Example: "CADUSD=X|MXNUSD=X|USDEUR=X".
- **financial-list** ( string / required ): Id of the financial list in Financial Selector ( won't be required once the component fully supports the symbols attribute ).
- **instrument-fields** ( array of strings / optional ): if not provided, all fields will be retrieved. Example: ```["instrument", "name", "lastPrice"]```
- **type**: 'realtime' ( default ) / 'historical'. See 'Historical Data' section above.
- **duration**: Day / Week / 1M ( default ) / 3M / 6M / 1Y / 5Y. Only used when type == 'historical'. See 'Historical Data' section above.
- **symbol** ( string ): Only used when type == 'historical'. indicates which instrument from the list of historical data needs to be retrieved. Example: 'AAPL.0'.

### Events

The component sends the following events:

- **_instruments-received_**: Instruments for the financial list provided have been successfully received from Firebase. The component is ready to execute getting data by dispatching _start_ event on the component.
- **_instruments-unavailable_**: Instruments were not able to be retrieved and the component will not be able to execute getting data. Potential reasons could be no network, required Firebase imports were not included in HTML page, or the financial list provided was not found.
- **_data-update_**: Data has been retrieved and the data object is provided in `event.detail`
- **_data-error_**: The financial server responded with a Error and the object is provided in `event.detail`
- **_request-error_**: There was a problem making the JSONP request to Financial server and the message object is provided in `event.detail`.

The component is listening for the following events:

- **_start_**: This event will initiate getting data from Financial server. It can be dispatch on the component when _instruments-received_ event has been fired as that event indicates the component successfully retrieved instruments and is ready to make a request to the Financial server to retrieve data.



## Built With
- [Polymer 3](https://www.polymer-project.org/)
- [Polymer CLI](https://github.com/Polymer/tools/tree/master/packages/cli)
- [WebComponents Polyfill](https://www.webcomponents.org/polyfills/)
- [npm](https://www.npmjs.org)
- [Firebase Realtime Database JavaScript SDK](https://firebase.google.com/docs/database/web/start)

## Development

### Local Development Build
Clone this repo and change into this project directory.

Execute the following commands in Terminal:

```
npm install
npm install -g polymer-cli
npm run build
```

**Note**: If EPERM errors occur then install polymer-cli using the `--unsafe-perm` flag ( `npm install -g polymer-cli --unsafe-perm` ) and/or using sudo.

### Testing
You can run the suite of tests either by command terminal or interactive via Chrome browser.

#### Command Terminal
Execute the following command in Terminal to run tests:

```
npm run test
```

#### Local Server
Run the following command in Terminal: `polymer serve`.

Now in your browser, navigate to:

```
http://127.0.0.1:8081/components/rise-data-financial/test/index.html
```
You can also run a specific test page by targeting the page directly:

```
http://127.0.0.1:8081/components/rise-data-financial/test/unit/rise-data-financial.html
```


## Submitting Issues
If you encounter problems or find defects we really want to hear about them. If you could take the time to add them as issues to this Repository it would be most appreciated. When reporting issues, please use the following format where applicable:

**Reproduction Steps**

1. did this
2. then that
3. followed by this (screenshots / video captures always help)

**Expected Results**

What you expected to happen.

**Actual Results**

What actually happened. (screenshots / video captures always help)

## Contributing
All contributions are greatly appreciated and welcome! If you would first like to sound out your contribution ideas, please post your thoughts to our [community](https://help.risevision.com/hc/en-us/community/topics), otherwise submit a pull request and we will do our best to incorporate it. Please be sure to submit test cases with your code changes where appropriate.

## Resources
If you have any questions or problems, please don't hesitate to join our lively and responsive [community](https://help.risevision.com/hc/en-us/community/topics).

If you are looking for help with Rise Vision, please see [Help Center](https://help.risevision.com/hc/en-us).

**Facilitator**

[Stuart Lees](https://github.com/stulees "Stuart Lees")
