# Sphero Cortex

This app lets you roll a Sphero Mini using an Emotiv Insight headset.

To run this application you need a client ID and secret from Emotiv Cortex API. Follow the documentation here: https://emotiv.gitbook.io/cortex-api/overview-of-api-flow. The headset ID can either be found using the Emotiv launcher (displayed after connection) or by executing the full authentication flow (check the program code).

Since Sphero doesn't have a public SDK we rely on opening the EDU app, placing the mouse on "RUN" and then the application will generate a click event (I know it's orrible, but what can we do). Some Sphero sample code is provided in this repo.

I use this app to run a 20-sided die which you can buy here: https://www.enza3d.net/shop/self-rolling-d20-print-files
