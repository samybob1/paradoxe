import _isRunning from 'is-running';
import { spawn } from 'child_process';
import path from 'path';
import { Mongo } from 'meteor/mongo';
import { Meteor } from 'meteor/meteor';
import fs from 'fs';

const isRunning = Meteor.wrapAsync(_isRunning);
const ElectronProcesses = new Mongo.Collection('processes');

const appExists = appPath => {
  try {
    return fs.statSync(appPath).isFile();
  } catch (e) {
    if (e.code === 'ENOENT') {
      return false;
    } else {
      throw e;
    }
  }
};

const ProcessManager = {
  add: pid => {
    if (pid) ElectronProcesses.insert({ pid });
  },

  isRunning: () => {
    let running = false;
    ElectronProcesses.find().forEach(proc => {
      if (isRunning(proc.pid)) {
        running = true;
      } else {
        ElectronProcesses.remove({ _id: proc._id });
      }
    });
    return running;
  },

  stopAll: () => {
    ElectronProcesses.find().forEach(proc => {
      if (isRunning(proc.pid)) process.kill(proc.pid);
      ElectronProcesses.remove({ pid: proc.pid });
    });
  },
};

const launchApp = buildInfo => {
  // Safeguard.
  if (process.env.NODE_ENV !== 'development') return;
  // if we did not force a rebuild and an instance is already running there is nothing to do
  if (!buildInfo.buildRequired && ProcessManager.isRunning()) return;

  // close all instances
  if (ProcessManager.isRunning()) {
    ProcessManager.stopAll();
  }

  let binaryPath = null;
  const args = [];

  if (process.platform === 'win32') {
    binaryPath = path.join(buildInfo.output, 'win-unpacked', `${buildInfo.name}.exe`);
  } else if (process.platform === 'darwin') {
    binaryPath = path.join(buildInfo.output, 'mac', `${buildInfo.name}.app`, 'Contents', 'MacOS', buildInfo.name);
    args.push(path.join(buildInfo.output, 'mac', `${buildInfo.name}.app`, 'Resources'));
  } else if (process.platform === 'linux') {
    binaryPath = path.join(buildInfo.output, 'linux-unpacked', buildInfo.productName);
  } else {
    throw new Error(`unsupported platform: ${process.platform}`);
  }

  if (appExists(binaryPath)) {
    const child = spawn(binaryPath, args);
    child.stdout.on('data', data => console.log('ATOM:', data.toString()));
    child.stderr.on('data', data => console.error('ATOM:', data.toString()));

    ProcessManager.add(child.pid);
  } else {
    console.error(`could not find an executable binary on ${binaryPath}, skipping app launch`)
  }
};

export default launchApp;
