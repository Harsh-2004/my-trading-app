const Web3 = require('web3');
const { ethers } = require('ethers');
const express = require('express');
const axios = require('axios');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt');
const { Sequelize } = require('sequelize');
const sequelize = require('./config/database');
const path = require('path');
const session = require('express-session');

// Import your models
const User = require('./models/User');
const Asset = require('./models/Asset');
const Portfolio = require('./models/Portfolio');
const Position = require('./models/Position');
const Transaction = require('./models/Transaction');
const Order = require('./models/Order');

const app = express();
const port = 3000;

app.use(bodyParser.json());
app.use(express.static('public'));

// Configure Covalent API endpoint URLs
const covalentBaseUrl = 'https://api.covalenthq.com/v1';
const chainId = '250';
const covalentApiKey = 'cqt_rQPBm6KpWHrCygctf87GHdhywJW7';

// Define model associations
User.hasMany(Portfolio, { foreignKey: 'user_id' });
Portfolio.belongsTo(User, { foreignKey: 'user_id' });

Portfolio.hasMany(Position, { foreignKey: 'portfolio_id' });
Position.belongsTo(Portfolio, { foreignKey: 'portfolio_id' });

Asset.hasMany(Position, { foreignKey: 'asset_id' });
Position.belongsTo(Asset);

Portfolio.hasMany(Transaction, { foreignKey: 'portfolio_id' });
Transaction.belongsTo(Portfolio, { foreignKey: 'portfolio_id' });

Asset.hasMany(Transaction, { foreignKey: 'asset_id' });
Transaction.belongsTo(Asset);

// Create a new web3 instance and connect to the Fantom mainnet
const web3 = new Web3('https://rpcapi.fantom.network/');

// Check if the connection is successful
web3.eth.net.isListening()
  .then(() => {
    console.log('Connected to Fantom mainnet');
  })
  .catch((error) => {
    console.error('Error connecting to Fantom mainnet:', error);
  });
app.use(session({
  secret: 'postgres123',
  resave: false,
  saveUninitialized: true
}));

// Define root route handler
app.get('/', (req, res) => {
  res.send('Welcome to the trading application!');
});

// Retrieve user profile information
app.get('/users/:userId', (req, res) => {
  const userId = req.params.userId;

  // Fetch user profile information from the database
  User.findByPk(userId)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      res.json(user);
    })
    .catch((error) => {
      console.error('Error retrieving user profile:', error);
      res.status(500).json({ error: 'An error occurred while retrieving user profile.' });
    });
});
// Define route handler for rendering the dashboard
app.get('/dashboard', async (req, res) => {
  try {
    const assets = await Asset.findAll(); // Retrieve the assets from the database

    // Render the dashboard template and pass the assets data to the template
    res.render('dashboard', { assets });
  } catch (error) {
    console.error('Error retrieving assets for dashboard:', error);
    res.status(500).send('An error occurred while retrieving assets for the dashboard.');
  }
});

// Fetch asset data from CoinCap API and store in the database
app.get('/fetch-assets', async (req, res) => {
  try {
    // Fetch asset data from CoinCap API
    const response = await axios.get('https://api.coincap.io/v2/assets');
    const assets = response.data.data;

    // Update or insert asset listings into the database
    for (const asset of assets) {
      const [record, created] = await Asset.findOrCreate({
        where: { name: asset.name },
        defaults: {
          symbol: asset.symbol,
          created_at: new Date(),
          updated_at: new Date(),
          price: asset.priceUsd
        }
      });

      if (!created) {
        await Asset.update(
          {
            symbol: asset.symbol,
            updated_at: new Date(),
            price: asset.priceUsd
          },
          {
            where: { name: asset.name }
          }
        );
      }
    }

    res.send('Asset data fetched and stored successfully!');
  } catch (error) {
    console.error('Error fetching and storing asset data:', error);
    res.status(500).send('An error occurred while fetching and storing asset data.');
  }
});






// Start the server
app.listen(3001, () => {
  console.log('Server is running on port 3001');
});



// Retrieve asset listings from the database
// Retrieve asset listings from the database
app.get('/assets', async (req, res) => {
  try {
    // Fetch asset listings from the database and limit to the top 10
    const assets = await Asset.findAll({
      order: [['id', 'ASC']],
      limit: 10
    });

    res.json(assets);
  } catch (error) {
    console.error('Error retrieving asset listings:', error);
    res.status(500).json({ error: 'An error occurred while retrieving asset listings.' });
  }
});




// Retrieve detailed information about a specific asset
// Retrieve detailed information about a specific asset
app.get('/assets/:assetName', async (req, res) => {
  try {
    const assetName = req.params.assetName;

    // Fetch asset details from the database
    const asset = await Asset.findOne({
      where: { name: assetName },
      attributes: ['id', 'name', 'symbol', 'price'] // Include the 'price' attribute
    });

    if (!asset) {
      return res.status(404).json({ error: 'Asset not found.' });
    }

    res.json(asset);
  } catch (error) {
    console.error('Error retrieving asset details:', error);
    res.status(500).json({ error: 'An error occurred while retrieving asset details.' });
  }
});

app.get('/trading-signals', async (req, res) => {
  try {
    const apiKey = 'ff3a1c177937929276b907794f260261034d08d3499e7338fce2d1ace0ac968b'; // Replace with your CryptoCompare API key
    const symbols = ['ETH', 'BTC', 'XRP', 'USDC', 'ADA', 'DOGE', 'LTC', 'MATIC', 'DOT', 'SHIB', 'AVAX'];

    const signals = [];

    // Fetch the trading signals for each cryptocurrency symbol
    for (const symbol of symbols) {
      try {
        const signalsResponse = await axios.get(`https://min-api.cryptocompare.com/data/tradingsignals/intotheblock/latest?fsym=${symbol}&api_key=${apiKey}`);
        const signal = signalsResponse.data;

        // Only add the cryptocurrency if a valid response is received
        if (signal.Response === 'Success') {
          signals.push(signal);
        }
      } catch (error) {
        console.error(`Error fetching trading signals for ${symbol}:`, error);
      }
    }

    res.json(signals);
  } catch (error) {
    console.error('Error fetching trading signals:', error);
    res.status(500).json({ error: 'An error occurred while fetching trading signals.' });
  }
});









// Place a buy or sell order for an asset
app.post('/orders', async (req, res) => {
  try {
    const { assetId, type, quantity, price } = req.body;
    const userId = req.session.userId;

    // Validate the input data

    // Create the order in the database
    const order = await Order.create({
      user_id: userId,
      asset_id: assetId,
      type,
      quantity,
      price,
      timestamp: new Date(),
    });

    // Execute the order and handle transactions on the Fantom blockchain

    res.status(201).json(order);
  } catch (error) {
    console.error('Error placing order:', error);
    res.status(500).json({ error: 'An error occurred while placing the order.' });
  }
});

// Create a transaction
app.post('/transactions', async (req, res) => {
  try {
    const { portfolioId, assetId, transactionType, quantity, price } = req.body;

    // Create the transaction in the database
    const transaction = await Transaction.create({
      portfolio_id: portfolioId,
      asset_id: assetId,
      transaction_type: transactionType,
      quantity,
      price,
      timestamp: new Date(),
    });

    res.status(201).json(transaction);
  } catch (error) {
    console.error('Error creating transaction:', error);
    res.status(500).json({ error: 'An error occurred while creating the transaction.' });
  }
});

// Fetch token metadata
app.get('/tokens/:tokenId', async (req, res) => {
  try {
    const tokenId = req.params.tokenId;

    // Fetch token metadata from Covalent API
    const response = await axios.get(`${covalentBaseUrl}/${chainId}/tokens/${tokenId}/?key=${covalentApiKey}`);

    const tokenMetadata = response.data.data;

    res.json(tokenMetadata);
  } catch (error) {
    console.error('Error fetching token metadata:', error);
    res.status(500).json({ error: 'An error occurred while fetching token metadata.' });
  }
});

// Retrieve token prices and market data
app.get('/tokens/:tokenId/market', async (req, res) => {
  try {
    const tokenId = req.params.tokenId;

    // Fetch token market data from Covalent API
    const response = await axios.get(`${covalentBaseUrl}/${chainId}/tokens/${tokenId}/market_data/?key=${covalentApiKey}`);

    const tokenMarketData = response.data.data;

    res.json(tokenMarketData);
  } catch (error) {
    console.error('Error fetching token market data:', error);
    res.status(500).json({ error: 'An error occurred while fetching token market data.' });
  }
});

// User registration endpoint
app.post('/api/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Perform input validation, e.g., check for required fields, email format, etc.

    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Store the user in the database
    const user = await User.create({
      username,
      email,
      password: hashedPassword,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    res.status(201).json(user);
  } catch (error) {
    console.error('Error registering user:', error);
    res.status(500).json({ error: 'An error occurred while registering the user.' });
  }
});

// User login endpoint
app.post('/api/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    // Fetch the user from the database based on the provided email
    const user = await User.findOne({ where: { email } });

    // Check if the user exists
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    // Compare the provided password with the hashed password stored in the database
    const passwordMatch = await bcrypt.compare(password, user.password);

    // Check if the passwords match
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }
    req.session.userId = user.id;
    // Password is correct, so the user is authenticated
    res.status(200).json({ message: 'Login successful!' });
  } catch (error) {
    console.error('Error logging in:', error);
    res.status(500).json({ error: 'An error occurred while logging in.' });
  }
});
// User login endpoint



// Add route handler for user profile
app.get('/user/profile', (req, res) => {
  const userId = req.session.userId; // Use req.session.userId instead of req.params.userId

  // Fetch user profile information from the database
  User.findByPk(userId)
    .then((user) => {
      if (!user) {
        return res.status(404).json({ error: 'User not found.' });
      }

      // Extract the necessary user profile data
      const userProfile = {
        username: user.username,
        email: user.email,
      };

      res.json(userProfile);
    })
    .catch((error) => {
      console.error('Error retrieving user profile:', error);
      res.status(500).json({ error: 'An error occurred while retrieving user profile.' });
    });
});

app.get('/dashboard', (req, res) => {
  if (req.session.userId) { // Check if the user session exists
    res.sendFile(path.join(__dirname, 'public/dashboard.html'));
  } else {
    res.redirect('/login');
  }
});


app.get('/test-fantom-connection', async (req, res) => {
  try {
    const isListening = await web3.eth.net.isListening();
    res.json({ connected: isListening });
  } catch (error) {
    console.error('Error checking Fantom connection:', error);
    res.status(500).json({ error: 'An error occurred while checking the Fantom connection.' });
  }
});

// Test database connection
app.get('/test-connection', (req, res) => {
  User.findOne()
    .then(() => {
      res.send('Database connection successful.');
    })
    .catch((error) => {
      console.error('Unable to connect to the database:', error);
      res.status(500).send('Database connection failed.');
    });
});
sequelize.sync()
  .then(() => {
    console.log('Asset model synchronized with the database');
  })
  .catch((error) => {
    console.error('Error synchronizing Asset model:', error);
  });

// Connect to the database and synchronize models
sequelize
  .authenticate()
  .then(() => {
    console.log('Database connection has been established successfully.');
    return sequelize.sync();
  })
  .then(() => {
    console.log('Models have been synchronized with the database.');
    // Start the server
    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  })
  .catch((error) => {
    console.error('Unable to connect to the database:', error);
  });
