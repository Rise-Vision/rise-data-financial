BASE_FILE="config/$1.js"
VERSION_FILE="config/version.js"

cp $BASE_FILE src/rise-data-financial-config.js
cp $VERSION_FILE src/rise-data-financial-version.js
