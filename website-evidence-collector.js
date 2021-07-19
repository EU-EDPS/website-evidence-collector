#!/usr/bin/env node
// jshint esversion: 8
/**
 * @file Collects evidence from websites on processed data in transit and at rest.
 * @author Robert Riemann <robert.riemann@edps.europa.eu>
 * @copyright European Data Protection Supervisor (2019)
 * @license EUPL-1.2
 */
const collector = require('./collector');
const argv = require('./lib/argv');

collector(argv._[0], argv);
