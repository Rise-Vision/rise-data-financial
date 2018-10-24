# Financial Data Web Component Demo

## Dependencies

Install global npm dependencies

```
npm install -g polymer-cli
```

**Note**: If EPERM errors occur then install polymer-cli using the
`--unsafe-perm` flag ( `npm install -g polymer-cli --unsafe-perm` )
and/or using sudo.

## Build

Create a standalone project using the contents of this directory as a base.

Then run:

```
npm install
polymer build
```

The 'polymer build' command needs to be run after each change to the source
code.

The output is created into the _build/prod_ directory.

## Run
The below options illustrate different ways to run this demo, however option A is most convenient.

### Option A
#### ChrOS Player as Packaged App in Chrome browser

All the contents of _build/prod_ must be uploaded to Rise Storage.
To avoid CORS issues, the server domain of the published file must be
risevision.com.

Then create a schedule that targets the URL of the published file, for example:

`http://widgets.risevision.com/staging/pages/2018.XX.XX.XX.XX/src/rise-data-financial-chromeos.html`

Then configure the local environment as described in the [Financial Templates First - Local Development](https://docs.google.com/document/d/1xbtDo9GnhbH0lGeQmgTdSb-U5ed0vTjufhxZBV-1C4A/edit) document.
It's not necessary to point the schedule to a local URL as it's described
there, with the above URL for the schedule is enough.

Once the application has been configured and ran, there will not be any visual aspects to the demo. You can view the dev console (follow instructions in document) and you will see logs pertaining to the component and eventual data retrieved.

#### Note

It's also possible to use another remote or local server other than Rise Storage, but there is a catch. Doing so will result in CORS-related errors due to browser restrictions.

A way to avoid such problems is to map remote server requests to local or remote locations
using a local proxy server such as [Charles](https://www.charlesproxy.com/).


### Option B
#### Electron Player

The `rise-data-financial-chromeos.html` is fixed for ChromeOS Player. To build the test page for Electron Player you should use the provided file `rise-data-financial-electron.html`. Before building the page it's necessary to change the following line in polymer.json:

```
  "entrypoint": "src/rise-data-financial-electron.html",
```

All the contents of _build/prod_ must be uploaded to Rise Storage.

Then create a schedule that targets the URL of the published file, for example:

`https://storage.googleapis.com/risemedialibrary-xxxxx-yyyy-xxx/src/rise-data-financial-chromeos.html`

#### Note

The page can be hosted on a different server or even a local server if your machine is capable of running a local Electron Player.

For example, to run a web server locally, you could run the following commands:

```
cd build/prod
python -m SimpleHTTPServer 8999
```

Then configure the schedule to point to the URL: `http://localhost:8999/src/rise-data-financial-electron.html`
