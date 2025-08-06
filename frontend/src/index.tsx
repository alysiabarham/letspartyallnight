// src/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css'; // Keep this if you have it
import App from './App';
import reportWebVitals from './reportWebVitals';

import { ChakraProvider } from '@chakra-ui/react';
// REMOVE 'import { extendTheme } from '@chakra-ui/react';' from here if it's separate

// Import BrowserRouter
import { BrowserRouter as Router } from 'react-router-dom';

import theme from './theme'; // <--- IMPORTANT: This line imports your custom theme

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <React.StrictMode>
    <ChakraProvider theme={theme}> {/* <--- Ensure theme={theme} is applied here */}
      {/* Wrap your App (which will contain routes) with Router */}
      <Router>
        <App />
      </Router>
    </ChakraProvider>
  </React.StrictMode>
);

reportWebVitals(); // Keep this line if you want web vitals reporting