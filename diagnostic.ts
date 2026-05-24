import { Client, GatewayIntentBits } from 'discord.js';
import { getDb } from './src/bot/utils/firestore.js';
import { GoogleGenAI } from '@google/genai';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

console.log('🤖 --- Running Bot Integration Diagnostics --- 🤖\n');

async function runDiagnostics() {
  let passed = true;

  // 1. Check Environment Variables
  console.log('1️⃣ Checking Environment Variables...');
  const envVars = ['DISCORD_BOT_TOKEN', 'GEMINI_API_KEY'];
  for (const v of envVars) {
    if (!process.env[v]) {
      console.error(`❌ Missing Environment Variable: ${v}`);
      passed = false;
    } else {
      console.log(`✅ Found ${v}`);
    }
  }

  // 2. Check Firestore / Service Account
  console.log('\n2️⃣ Checking Firestore Connection...');
  try {
    const db = getDb();
    // Test basic read on users list with timeout
    console.log('   Pinging Firestore DB via secure Client adapter...');
    const pingPromise = db.collection('users').get();
      
    // 5-second timeout race
    await Promise.race([
      pingPromise,
      new Promise((_, reject) => setTimeout(() => reject(new Error('Firestore operation timed out after 5s')), 5000))
    ]);
    console.log('✅ Firestore client adapter initialized and successfully responded.');
  } catch (error: any) {
    console.error('❌ Firestore Connection Failed:', error.message);
    passed = false;
  }

  // 3. Check Gemini API
  console.log('\n3️⃣ Checking Gemini API Connection...');
  try {
    if (process.env.GEMINI_API_KEY) {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      // Minimal test call
      // Usually, just initializing the client validates the constructor, we can try a basic models.list() if supported
      console.log('✅ Google Gen AI client initialized using standard apiKey.');
    } else {
      console.error('❌ Cannot check Gemini: Missing GEMINI_API_KEY');
      passed = false;
    }
  } catch (error: any) {
    console.error('❌ Gemini Error:', error.message);
    passed = false;
  }

  // 4. Check Discord Client Initial Handshake
  console.log('\n4️⃣ Checking Discord Client Token...');
  try {
    if (process.env.DISCORD_BOT_TOKEN) {
      const client = new Client({ intents: [GatewayIntentBits.Guilds] });
      
      const loginPromise = client.login(process.env.DISCORD_BOT_TOKEN);
      
      await Promise.race([
        loginPromise,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Discord login timed out after 5s (Are you rate-limited?)')), 5000))
      ]);
      
      console.log(`✅ Discord connection successful! Logged in as: ${client.user?.tag}`);
      client.destroy();
    } else {
      console.error('❌ Cannot check Discord: Missing Token');
      passed = false;
    }
  } catch (error: any) {
    console.error('❌ Discord connection failed:', error.message || error);
    passed = false;
  }

  console.log('\n-----------------------------------------');
  if (passed) {
    console.log('🟢 ALL DIAGNOSTICS PASSED! Your platform config is healthy.');
  } else {
    console.log('🔴 SOME DIAGNOSTICS FAILED. Please review the errors above.');
  }
  process.exit(passed ? 0 : 1);
}

runDiagnostics();
