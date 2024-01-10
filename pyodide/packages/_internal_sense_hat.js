/**
 * Internal SenseHat Module for reading and writing values from
 * JavaScript World to the Python World. This modules set ups
 * the commmunication and allows to read and write pixels.
 */

export const config = {
  pyodide: null,
  emit: () => {},
  colour: "#FF00A4",
  gamma: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
  low_light: false,
  mz_criteria: {
    duration: null,
    noInputEvents: true,
    readColour: false,
    readHumidity: false,
    readPressure: false,
    readTemperature: false,
    usedLEDs: false,
  },
};

const raisePythonValueError = (message) => {
  if (config.pyodide) {
    const escaped = message.replaceAll('"', '\\"');
    config.pyodide.runPython(`raise ValueError("${escaped}")`);
  } else {
    throw new TypeError(message);
  }
};

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
  var _index;
  var _value;

  if (!Sk.builtin.checkIterable(value)) {
    raisePythonValueError("'value' should be iterable")
  }

  for (var i in value.v) {
    if (!Sk.builtin.checkInt(value.v[i])) {
      raisePythonValueError("'value' should be iterable of 'int'")
    }
  }

  _index = Sk.ffi.remapToJs(index);
  _value = Sk.ffi.remapToJs(value);

  try {
    Sk.sense_hat.pixels[_index] = _value;
  } catch (e) {
    raisePythonValueError(e.message);
  }

  config.emit('setpixel', _index);
};

export const getpixel = (index) => {
  var value;
  var _index;
  var _value;

  _index = Sk.ffi.remapToJs(index);

  try {
    _value = Sk.sense_hat.pixels[_index];
    value = Sk.ffi.remapToPy(_value); // should return a list
    //value = new Sk.builtin.list(value);
  } catch (e) {
    raisePythonValueError(e.message);
  }

  return value;
};

export const setpixels = (indexes, values) => {
  if (Sk.ffi.remapToJs(indexes)) {
    config.mz_criteria.usedLEDs = true
  }
  _indexes = Sk.ffi.remapToJs(indexes);
  _values = Sk.ffi.remapToJs(values);
  try {
    Sk.sense_hat.pixels = _values;
  } catch (e) {
    raisePythonValueError(e.message);
  }

  config.emit('setpixels', _indexes);
};

export const getpixels = () => {
  var values;

  try {
    values = Sk.ffi.remapToPy(Sk.sense_hat.pixels); // should return a list
    values = new Sk.builtin.list(values);
  } catch (e) {
    raisePythonValueError(e.message);
  }

  return values;
};

export const getGamma = () => {
  var gamma = Sk.ffi.remapToPy(config.gamma);
  return gamma;
};

export const setGamma = (gamma) => {
  // checks are made in fb_device.py
  var _gamma = Sk.ffi.remapToJs(gamma);
  config.gamma = _gamma;

  config.emit('setGamma');
};

export const setLowlight = (value) => {
  var _value = Sk.ffi.remapToJs(value);

  config.low_light = _value;

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

  if (!Sk.sense_hat.rtimu.pressure || Sk.sense_hat.rtimu.pressure.length !== 2) {
    // something was set wrong
    return Sk.ffi.remapToPy([].concat([0, -1], jsTemperature));
  }

  // check type of the temperature
  jsPressure = checkNumberAndReturn(Sk.sense_hat.rtimu.pressure[1]);

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

  if (!Sk.sense_hat.rtimu.humidity || Sk.sense_hat.rtimu.humidity.length !== 2) {
    // something was set wrong
    return Sk.ffi.remapToPy([].concat([0, -1], jsTemperature));
  }

  // check type of the temperature
  jsHumidity = checkNumberAndReturn(Sk.sense_hat.rtimu.humidity[1]);

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

  if (!Sk.sense_hat.rtimu.temperature || Sk.sense_hat.rtimu.temperature.length !== 2) {
    // something was set wrong
    return Sk.ffi.remapToPy([0, -1]);
  }

  // check type of the temperature
  var jsTemperature = checkNumberAndReturn(Sk.sense_hat.rtimu.temperature[1]);

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

export const  colourRead = () => {
  config.mz_criteria.readColour = true
  return Sk.ffi.remapToPy(hex2rgb(config.colour));
};

/**
 * Motion
 */
export const motionRead = () => (
  Sk.ffi.remapToPy(Sk.sense_hat.motion)
);

/**
 * Sets start motion callback
 */
export const _start_motion = (callback) => {
  if (!(callback instanceof Sk.builtin.none)) {
    Sk.sense_hat.start_motion_callback = () => {Sk.misceval.callsimAsync(null, callback)};
  }
};

/**
 * Sets stop motion callback
 */
export const _stop_motion = (callback) => {
  if (!(callback instanceof Sk.builtin.none)) {
    Sk.sense_hat.stop_motion_callback = () => {Sk.misceval.callsimAsync(null, callback)};
  }
};

export const fusionPoseRead = () => {
  var fusionPose = Sk.ffi.remapToPy(Sk.sense_hat.rtimu.raw_orientation.map(x=>x*Math.PI/180));
  return fusionPose;
};

export const accelRead = () => {
  var accel = Sk.ffi.remapToPy(Sk.sense_hat.rtimu.accel);
  return accel;
};

export const compassRead = () => {
  var compass = Sk.ffi.remapToPy(Sk.sense_hat.rtimu.compass);
  return compass;
};

export const headingRead = () => {
  /* Returns tilt-compensated magnetometer heading in radians */
  /* Note: RTIMULib calculates a moving average. This gives an instant reading */

  // Accelerometer's roll and pitch, used for compensation
  var x, y;
  x = Sk.sense_hat.rtimu.raw_orientation[0]; // roll
  y = Sk.sense_hat.rtimu.raw_orientation[1]; // pitch

  // Compass raw values in microteslas
  var mx, my, mz;
  mx = Sk.sense_hat.rtimu.compass[0];
  my = Sk.sense_hat.rtimu.compass[1];
  mz = Sk.sense_hat.rtimu.compass[2];

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
  var gyro = Sk.ffi.remapToPy(Sk.sense_hat.rtimu.gyro);
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
