require('babel-register');
require('babel-polyfill');

module.exports = {
  // See <http://truffleframework.com/docs/advanced/configuration>
  // to customize your Truffle configuration!
  networks: {
    mainnet: {
      host: 'localhost',
      port: 8545,
      network_id: '1', // Match any network id
      gas: 3500000,
      gasPrice: 10000000000
    },
    development: {
      host: "localhost",
      port: 7545,
      network_id: "*", // Match any network id
      gas: 4500000,
    },
    coverage: {
      host: "localhost",
      port: 7545,
      network_id: "*", // Match any network id
      gas: 45000000,
    },
    ropsten : {
      host: "127.0.0.1",
      port: 8545,
      network_id: "3", // Match any network id
      gas: 4500000,
    }
  },
  dependencies: {},
  solc: {
    optimizer: {
      enabled: true,
      runs: 200,
    },
  },
};
