/**
 * Test Setup
 * Global test configuration and utilities for RSS Amplifier tests
 */

import { expect } from 'chai';
import sinon from 'sinon';

// Make chai and sinon available globally for tests
global.expect = expect;
global.sinon = sinon;

// Set up test environment
process.env.NODE_ENV = 'test';