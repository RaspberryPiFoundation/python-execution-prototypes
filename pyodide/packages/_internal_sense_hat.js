/**
 * Internal SenseHat Module for reading and writing values from
 * JavaScript World to the Python World. This modules set ups
 * the commmunication and allows to read and write pixels.
 */

export const config = {
  pyodide: null,
  emit: () => {},
  colour: "#FF00A4",
  gamma: new Array(32).fill(0),
  pixels: new Array(64).fill([0, 0, 0]),
  low_light: false,
  motion: false,
  mz_criteria: {
    duration: null,
    noInputEvents: true,
    readColour: false,
    readHumidity: false,
    readPressure: false,
    readTemperature: false,
    usedLEDs: false,
  },
  rtimu: {
    pressure: [1, 1013 + Math.random() - 0.5],
    temperature: [1, 13 + Math.random() - 0.5],
    humidity: [1, 45 + Math.random() - 0.5],
    gyro: [0, 0, 0] /* all 3 gyro values */,
    accel: [0, 0, 0] /* all 3 accel values */,
    compass: [0, 0, 33] /* all compass values */,
    raw_orientation: [0, 90, 0],
  },
  sensestick: {
    _eventQueue: [],
    off: () => {},
    once: () => {},
  },
  start_motion_callback: () => {},
  stop_motion_callback: () => {},
};

const raisePythonValueError = (message) => {
  if (config.pyodide) {
    const escaped = message.replaceAll('"', '\\"');
    config.pyodide.runPython(`raise ValueError("${escaped}")`);
  } else {
    throw new TypeError(message);
  }
};

const toJs = (val) => val?.toJs ? val.toJs() : val;
const isIterable = (val) => !!val.[Symbol.iterator];
const isInteger = (val) => val === parseInt(val, 10);

const checkNumberAndReturn = (val) => {
  var parsed = parseFloat(val);
  // only numbers/floats are okay
  var isValid = !isNaN(parsed) && isFinite(val);
  if (isValid) {
    return {
      value: parsed,
      valid: true
    }
  }

  // invalid number, return -1
  return {
    value: -1,
    valid: false
  }
};

export const init = () => {
  config.emit('init');
};

// _fb_device specific methods
export const setpixel = (index, value) => {
  config.mz_criteria.usedLEDs = true

  const _index = toJs(index);
  const _value = toJs(value);

  if (!isIterable(_value)) {
    raisePythonValueError("'value' should be iterable")
  }

  for (let val of _value) {
    if (!isInteger(val)) {
      raisePythonValueError("'value' should be iterable of 'int'")
    }
  }

  try {
    config.pixels[_index] = _value;
  } catch (e) {
    raisePythonValueError(e.message);
  }

  config.emit('setpixel', _index);
};

export const getpixel = (index) => {
  const _index = toJs(index);

  try {
    return config.pixels[_index];
  } catch (e) {
    raisePythonValueError(e.message);
  }
};

export const setpixels = (indexes, values) => {
  const _indexes = toJs(indexes);
  const _values = toJs(values);

  if (_indexes) {
    config.mz_criteria.usedLEDs = true
  }

  try {
    config.pixels = _values;
  } catch (e) {
    raisePythonValueError(e.message);
  }

  config.emit('setpixels', _indexes);
};

export const getpixels = () => {
  return config.pixels;
};

export const getGamma = () => {
  return config.gamma;
};

export const setGamma = (gamma) => {
  // checks are made in fb_device.py
  config.gamma = toJs(gamma);
  config.emit('setGamma');
};

export const setLowlight = (value) => {
  config.low_light = toJs(value);
  config.emit('changeLowlight', _value);
};

// RTIMU stuff

/**
 * 260 - 1260 hPa
 */
export const pressureRead = () => {
  config.mz_criteria.readPressure = true
  var pyTemperature = Sk.misceval.callsim(mod.temperatureRead); // does the validation for us
  var jsTemperature = Sk.ffi.remapToJs(pyTemperature);

  var jsPressure; // object holding the parsed value

  if (!config.rtimu.pressure || config.rtimu.pressure.length !== 2) {
    // something was set wrong
    return Sk.ffi.remapToPy([].concat([0, -1], jsTemperature));
  }

  // check type of the temperature
  jsPressure = checkNumberAndReturn(config.rtimu.pressure[1]);

  // invalid value provided
  if (jsPressure.valid === false) {
    return Sk.ffi.remapToPy([].concat([0, -1], jsTemperature));
  }

  // now do some range checks
  if (jsPressure.value < 260 || jsPressure.value > 1260) {
    return Sk.ffi.remapToPy([].concat([0, jsPressure.value], jsTemperature));
  }

  return Sk.ffi.remapToPy([].concat([1, jsPressure.value], jsTemperature));
};

/**
 * >= 0%
 */
export const humidityRead = () => {
  config.mz_criteria.readHumidity = true
  var pyTemperature = Sk.misceval.callsim(mod.temperatureRead); // does the validation for us
  var jsTemperature = Sk.ffi.remapToJs(pyTemperature);

  var jsHumidity;

  if (!config.rtimu.humidity || config.rtimu.humidity.length !== 2) {
    // something was set wrong
    return Sk.ffi.remapToPy([].concat([0, -1], jsTemperature));
  }

  // check type of the temperature
  jsHumidity = checkNumberAndReturn(config.rtimu.humidity[1]);

  // invalid value provided
  if (jsHumidity.valid === false) {
    return Sk.ffi.remapToPy([].concat([0, -1], jsTemperature));
  }

  // now do some range checks
  if (jsHumidity.value < 0) {
    return Sk.ffi.remapToPy([].concat([0, jsHumidity.value], jsTemperature));
  }

  return Sk.ffi.remapToPy([].concat([1, jsHumidity.value], jsTemperature));
};

/**
 * Temperature Range: -40 to +120 degrees celsius
 */
export const temperatureRead = () => {
  config.mz_criteria.readTemperature = true
  var jsTemperature;

  if (!config.rtimu.temperature || config.rtimu.temperature.length !== 2) {
    // something was set wrong
    return Sk.ffi.remapToPy([0, -1]);
  }

  // check type of the temperature
  var jsTemperature = checkNumberAndReturn(config.rtimu.temperature[1]);

  // invalid value provided
  if (jsTemperature.valid === false) {
    return Sk.ffi.remapToPy([0, -1]);
  }

  // now do some range checks
  if (jsTemperature.value < -40 || jsTemperature.value > 120) {
    return Sk.ffi.remapToPy([0, jsTemperature.value]); // invalid
  }

  return Sk.ffi.remapToPy([1, jsTemperature.value]);
};

/**
 * Colour
 */

const hex2rgb = (hex) => (
  ['0x' + hex[1] + hex[2] | 0, '0x' + hex[3] + hex[4] | 0, '0x' + hex[5] + hex[6] | 0]
);

export const colourRead = () => {
  config.mz_criteria.readColour = true
  return Sk.ffi.remapToPy(hex2rgb(config.colour));
};

/**
 * Motion
 */
export const motionRead = () => (
  Sk.ffi.remapToPy(config.motion)
);

/**
 * Sets start motion callback
 */
export const _start_motion = (callback) => {
  if (callback) { config.start_motion_callback = callback; }
};

/**
 * Sets stop motion callback
 */
export const _stop_motion = (callback) => {
  if (callback) { config.stop_motion_callback = callback; }
};

export const fusionPoseRead = () => {
  var fusionPose = Sk.ffi.remapToPy(config.rtimu.raw_orientation.map(x=>x*Math.PI/180));
  return fusionPose;
};

export const accelRead = () => {
  var accel = Sk.ffi.remapToPy(config.rtimu.accel);
  return accel;
};

export const compassRead = () => {
  var compass = Sk.ffi.remapToPy(config.rtimu.compass);
  return compass;
};

export const headingRead = () => {
  /* Returns tilt-compensated magnetometer heading in radians */
  /* Note: RTIMULib calculates a moving average. This gives an instant reading */

  // Accelerometer's roll and pitch, used for compensation
  var x, y;
  x = config.rtimu.raw_orientation[0]; // roll
  y = config.rtimu.raw_orientation[1]; // pitch

  // Compass raw values in microteslas
  var mx, my, mz;
  mx = config.rtimu.compass[0];
  my = config.rtimu.compass[1];
  mz = config.rtimu.compass[2];

  // Tilt compensation for Tait-Bryan XYZ convention
  // Formulas here: https://dev.widemeadows.de/2014/01/24/to-tilt-compensate-or-not-to-tilt-compensate/
  var phi, theta, mag_y, mag_x, jsheading, heading;
  phi = x;
  theta = y;

  // Remap magnetometer values to the horizontal plane and determine yaw (aka heading)
  mag_x = mx * Math.cos(theta) + my * Math.sin(phi) * Math.sin(phi) + mz * Math.cos(phi) * Math.sin(theta);
  mag_y = my * Math.cos(phi) - mz * Math.sin(phi);
  jsheading = Math.atan2(-mag_y, mag_x);

  // Remap radian value to Skulpt and return
  heading = Sk.ffi.remapToPy(jsheading);
  return heading;
};

export const gyroRead = () => {
  var gyro = Sk.ffi.remapToPy(config.rtimu.gyro);
  return gyro;
};

/********************************************************/
/* SenseStick specific functions. Commented out until we have a means of inputting
/* sense stick events and can be made to work with the web component
/*
/*
 **/

export const _wait = (timeout) => {
  throw new Error("NotImplementedError")
};

export const _waitmotion = (timeout, motion) => {
  config.mz_criteria.noInputEvents = false
  throw new Error("NotImplementedError")
};

export const _inspectFunction = (func) => {
  throw new Error("NotImplementedError")
};

/**
 * Removes the event handler for simulating threading
 */
export const _stop_stick_thread = () => {
  throw new Error("NotImplementedError")
};

/**
 * Adds the event handler for simulating threading for the SenseStick callbacks
 */
export const _start_stick_thread = (callback) => {
  throw new Error("NotImplementedError")
};

export const _read = () => {
  throw new Error("NotImplementedError")
};
