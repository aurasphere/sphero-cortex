async function startProgram() {
  await delay(0.1);
  for (var _i0 = 0; _i0 < 5; ++_i0) {
    setMainLed(getRandomColor());
    await roll(getRandomInt(1, 360), 255, 1);
    await delay(0.025);
  }
  exitProgram();
}
