import dotenv from "dotenv";
import robot from "robotjs";
import WebSocket from "ws";

dotenv.config();

function createEmotivRequest(id, method, params) {
  return {
    id,
    jsonrpc: "2.0",
    method,
    params,
  };
}

function sendCommand(id, method, params) {
  const command = JSON.stringify(createEmotivRequest(id, method, params));
  console.log(`Sending command ${command}`);
  ws.send(command);
}

const ws = new WebSocket("wss://localhost:6868", {
  perMessageDeflate: false,
  // The EMOTIV certificate is self signed and I don't really care about security of this app
  rejectUnauthorized: false,
});

ws.on("open", authenticate);
ws.on("message", handleMessage);
ws.on("error", handleError);

let cortexToken;
let sessionId;
let headsetId = "INSIGHT-59683B0B";
const firstCommandId = headsetId == null ? 1 : 3;
function authenticate() {
  console.log("Authenticating to EMOTIV");
  // To scan for devices and connect use 1 as the ID, otherwise use 3 to connect
  // with a fixed ID
  sendCommand(firstCommandId, "requestAccess", {
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
  });
}

function handleError(error) {
  console.error(`Error: ${JSON.stringify(error)}`);
}

function handleMessage(message) {
  // console.log(`Received message ${message}`);
  const messageObject = JSON.parse(message);
  if (messageObject.error != null) {
    handleError(messageObject);
  } else if (messageObject.id == null) {
    handleSubscriptionData(messageObject);
  } else {
    handleAuthenticationFlow(messageObject);
  }
}

function handleAuthenticationFlow({ result, id }) {
  console.log(`Received response to step ${id}`);
  switch (id) {
    case 1:
      sendCommand(2, "controlDevice", { command: "refresh" });
      break;
    case 2:
      // Waits for scan to be completed
      setTimeout(() => sendCommand(3, "queryHeadsets"), 20_000);
      break;
    case 3:
      headsetId ??= result[0].id;
      sendCommand(4, "controlDevice", {
        command: "connect",
        headset: headsetId,
      });
      break;
    case 4:
      sendCommand(5, "authorize", {
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
      });
      break;
    case 5:
      cortexToken = result.cortexToken;
      sendCommand(6, "createSession", {
        cortexToken: cortexToken,
        status: firstCommandId === 1 ? "active" : "open",
        headset: headsetId,
      });
      break;
    case 6:
      sessionId = result.id;
      sendCommand(7, "subscribe", {
        cortexToken: cortexToken,
        session: sessionId,
        streams: ["pow", "eq"],
      });
      break;
  }
}

function handleSubscriptionData(data) {
  if (data.pow != null) {
    handleBandPower(data);
  } else if (data.com != null) {
    handleMentalCommand(data);
  } else if (data.eq != null) {
    handleEegQuality(data);
  } else {
    console.error(`Received unknown message ${JSON.stringify(data)}`);
  }
}

let eyesClosedCounter = 0;
function handleBandPower({ pow }) {
  // console.log(`Received band power data ${JSON.stringify(pow)}`);
  const [
    af3Theta,
    af3Alpha,
    af3BetaL,
    af3BetaH,
    af3Gamma,
    t7Theta,
    t7Alpha,
    t7BetaL,
    t7BetaH,
    t7Gamma,
    pzTheta,
    pzAlpha,
    pzBetaL,
    pzBetaH,
    pzGamma,
    t8Theta,
    t8Alpha,
    t8BetaL,
    t8BetaH,
    t8Gamma,
    af4Theta,
    af4Alpha,
    af4BetaL,
    af4BetaH,
    af4Gamma,
  ] = pow;
  const avgAlpha = average([af3Alpha, t7Alpha, t8Alpha]);
  const avgBetaL = average([af3BetaL, t7BetaL, t8BetaL]);
  const avgBetaH = average([af3BetaH, t7BetaH, t8BetaH]);
  const avgGamma = average([af3Gamma, t7Gamma, t8Gamma]);
  const avgTheta = average([af3Theta, t7Theta, t8Theta]);
  console.log({ avgAlpha, avgBetaL, avgBetaH, avgGamma, avgTheta });
  if (avgAlpha > 3 && avgTheta > 4) {
    eyesClosedCounter++;
  } else {
    eyesClosedCounter = 0;
  }
  if (eyesClosedCounter > 10) {
    console.log("\x07");
    eyesClosedCounter = 0;
    throttledClickFunction();
  }
}

function average(values) {
  return values.reduce((p, c) => p + c, 0) / values.length;
}

function handleMentalCommand({ com }) {
  console.log(`Received mental command data ${JSON.stringify(com)}`);
}

function handleEegQuality({ eq }) {
  const [batteryPercent, overall, sampleRateQuality, AF3, T7, Pz, T8, AF4] = eq;
  const averageUsedSensorQuality = average([AF3, T7, T8]);
  if (averageUsedSensorQuality < 2) {
    console.error(
      `Poor eeg quality (${averageUsedSensorQuality}), disabling output`
    );
    eyesClosedCounter = 0;
  }
}

function throttle(mainFunction) {
  let timer = null;
  return (...args) => {
    if (timer === null) {
      mainFunction(...args);
      timer = setTimeout(() => {
        timer = null;
      }, 20000);
    }
  };
}
const throttledClickFunction = throttle(robot.mouseClick);
