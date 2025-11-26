#!/usr/bin/env node
/**
 * Create Test User Script
 *
 * Creates a test user account via the API
 * Usage: node create-test-user.js
 */

const http = require('http');

const postData = JSON.stringify({
  email: 'test@example.com',
  password: 'Cocktail2025!'
});

const options = {
  hostname: 'localhost',
  port: 3000,
  path: '/auth/signup',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';

  res.on('data', (chunk) => {
    data += chunk;
  });

  res.on('end', () => {
    console.log('Status Code:', res.statusCode);
    console.log('Response:', data);

    if (res.statusCode === 201) {
      console.log('\n✅ Test user created successfully!');
      console.log('Email: test@example.com');
      console.log('Password: Cocktail2025!');
    } else {
      console.log('\n❌ Failed to create test user');
    }
  });
});

req.on('error', (error) => {
  console.error('Error:', error);
});

req.write(postData);
req.end();
