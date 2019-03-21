# Financial Data Web Component [![CircleCI](https://circleci.com/gh/Rise-Vision/rise-data-financial/tree/master.svg?style=svg)](https://circleci.com/gh/Rise-Vision/rise-data-financial/tree/master)

## Introduction

`rise-data-financial` is a Polymer 3 Web Component that retrieves licensed Financial data from the Rise Vision Financial Server API.

Instructions for demo page here:
https://github.com/Rise-Vision/rise-data-financial/blob/master/demo/README.md

## Usage

The below illustrates simple usage of the component and listening to the `rise-components-ready` event to initiate. This is required in order to know that the component has been imported to the page. See the demo section in this repo for a full working example of an HTML page using the component which will illustrate required imports in the `<head>` of the page.

### Example

```
  <body>
    <script>
      function configureComponents( evt ) {
        const start = new CustomEvent( "start" ),
        	financial01 = document.querySelector('#rise-data-financial-01');

      	financial01.addEventListener( "data-update", ( evt ) => {
        	console.log( "data update", JSON.stringify(evt.detail) );
      	} );

      	financial01.addEventListener( "data-error", ( evt ) => {
        	console.log( "data error", evt.detail );
      	} );

      	financial01.addEventListener( "request-error", ( evt ) => {
        	console.log( "request error", evt.detail );
      	} );

      	// Start the component once it's configured, but if it's already
      	// configured the listener won't work, so we directly send the
      	// request also.
      	financial01.addEventListener('configured', () =>
        	financial01.dispatchEvent( new CustomEvent( "start" ) )
      	);

      	financial01.dispatchEvent( new CustomEvent( "start" ) );
      }

      window.addEventListener( "rise-components-ready", configureComponents);
    </script>

    <rise-data-financial
      id="financial01"
      symbols="C.N|IBM.N|KO|WMT.N"
      instrument-fields='["name", "lastPrice", "netChange", "percentChange"]'>
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
  symbols=".ABC|.DEF"
  instrument-fields='["instrument", "name"]'>
</rise-data-financial>
```

### Historical Data
To request historical data, the `type` attribute must be set to `historical` and `duration` must be set to one of: `Day`, `Week`, `1M`, `3M`, `6M`, `1Y` or `5Y`.

Valid values for the `instrument-fields` attribute for historical data are: `accumulatedVolume`, `closePrice`, `intervalVolume`, `percentChange` and `tradeTime`.

If no `instrument-fields` attribute is provided, all fields are returned by default.

#### Example

```
<rise-data-financial
  duration="1M"
  symbols=".ABC|.DEF"
  instrument-fields='["closePrice", "percentChange"]'
  type="historical">
</rise-data-financial>
```

### Data Object

When listening for the "data-update" event, the `event.detail` object returned is an object of the following format:

![rise-financial data](https://content.screencast.com/users/stulees/folders/Snagit/media/d7bd19a3-c6ac-4bbc-8072-42e2cf3393d3/2019-03-13_13-07-58.png)

_data_ is an object with _cols_ and _rows_ properties, where _cols_ is an array that contains additional information about the requested fields, and _rows_ is an array that contains the actual data.

### Labels

The component may define a 'label' attribute that defines the text that will appear for this instance in the template editor.

This attribute holds a literal value, for example:

```
  <rise-data-financial
    id="financial01"
    category="currencies"
    label="Example Label"
    symbols="CADUSD=X|MXNUSD=X|USDEUR=X"
    instrument-fields='["instrument", "name", "lastPrice", "netChange"]'>
  </rise-data-financial>
```

If it's not set, the label for the component defaults to "Financial", which is applied via the    [generate_blueprint.js](https://github.com/Rise-Vision/html-template-library/blob/master/generate_blueprint.js) file for a HTML Template build/deployment.

### Attributes

This component receives the following list of attributes:

- **id**: ( string / required ): Unique HTML id with format 'rise-data-financial-<NAME_OR_NUMBER>'.
- **symbols** ( string / required ): List of symbols separated by pipe symbol. Example: "CADUSD=X|MXNUSD=X|USDEUR=X".
- **label**: ( string ): An optional label key for the text that will appear in the template editor. See 'Labels' section above.
- **category**: "bonds" / "commodities" / "currencies" / "market statistics" / "stocks" / "world indexes". Required if the component is editable.
- **instrument-fields** ( array of strings / optional ): if not provided, all fields will be retrieved. Example: ```["instrument", "name", "lastPrice"]```
- **type**: 'realtime' ( default ) / 'historical'. See 'Historical Data' section above.
- **duration**: Day / Week / 1M ( default ) / 3M / 6M / 1Y / 5Y. Only used when type == 'historical'. See 'Historical Data' section above.
- **non-editable**: ( empty / optional ): If present, it indicates this component is not available for customization in the template editor.

### Events

The component sends the following events:

- **_configured_**: The component has initialized what it requires to and is ready to handle a _start_ event.
- **_data-update_**: Data has been retrieved and the data object is provided in `event.detail`
- **_data-error_**: The financial server responded with a Error and the object is provided in `event.detail`
- **_request-error_**: There was a problem making the JSONP request to Financial server and the message object is provided in `event.detail`.

The component is listening for the following events:

- **_start_**: This event will initiate getting data from Financial server. It can be dispatched on the component when _configured_ event has been fired as that event indicates the component has initialized what it requires to and is ready to make a request to the Financial server to retrieve data.

### Errors

The component may log the following errors:

- **_request-error_**: There was a problem making the JSONP request to Financial server.
- **_data-error_**: The financial server responded with an error.
- **_Rise is not permissioned to show the instrument_**: Shown when financial server returned a 'N/P' status for an instrument / symbol. The event details will include the component symbols property.
- **_Instrument is unavailable, invalid or unknown_**: Shown when financial server returned a 'N/A' status for an instrument / symbol. The event details will include the component symbols property.
- **_Display is not permissioned to show the instrument_**: Shown when financial server returned a 'S/P' status for an instrument / symbol. The event details will include the component symbols property.

In every case, examine event-details entry and the other event fields for more information about the problem.

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
