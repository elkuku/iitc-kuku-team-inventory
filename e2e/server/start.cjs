'use strict';
// Launcher for the mock IITC server — plain CJS so it works with
// node directly even though the project uses "type": "module".
const path = require('path');

// Point ts-node at the e2e server tsconfig (commonjs module system)
process.env.TS_NODE_PROJECT = path.join(__dirname, 'tsconfig.json');

const tsNodeRegister = require.resolve('ts-node/register', {
  paths: [
    __dirname,
    path.join(__dirname, '..'),
    path.join(__dirname, '../..'),
    path.join(__dirname, '../../node_modules'),
  ],
});
require(tsNodeRegister);

require('./index.ts');
