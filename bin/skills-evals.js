#!/usr/bin/env node
'use strict';

process.exit(require('../src/cli').main(process.argv.slice(2)));
