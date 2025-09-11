#!/usr/bin/env ts-node

import dotenv from 'dotenv';

dotenv.config();

interface FetchOptions {
  proposalId: number;
  from?: string;
  to?: string;
  interval?: string;
  limit?: number;
}

async function fetchHistoricalData(options: FetchOptions) {
  const API_URL = process.env.API_URL || 'http://localhost:3000';
  const API_KEY = process.env.API_KEY;
  
  if (!API_KEY) {
    console.error('API_KEY environment variable is required');
    process.exit(1);
  }

  const { proposalId, from, to, interval, limit } = options;
  
  const headers = {
    'Content-Type': 'application/json',
    'X-API-KEY': API_KEY
  };

  console.log(`\n🔍 Fetching historical data for proposal ${proposalId}\n`);
  console.log(`API URL: ${API_URL}`);
  if (from) console.log(`From: ${from}`);
  if (to) console.log(`To: ${to}`);
  if (interval) console.log(`Interval: ${interval}`);
  if (limit) console.log(`Limit: ${limit}`);
  console.log('─'.repeat(80));

  try {
    // 1. Fetch current TWAP data
    console.log('\n📊 Current TWAP Data:');
    try {
      const twapResponse = await fetch(`${API_URL}/api/twap/${proposalId}`, {
        method: 'GET',
        headers
      });
      
      if (twapResponse.ok) {
        const twapData = await twapResponse.json();
        console.log(JSON.stringify(twapData, null, 2));
      } else {
        const error = await twapResponse.json();
        console.log(`❌ Error: ${JSON.stringify(error, null, 2)}`);
      }
    } catch (error: any) {
      console.log(`❌ Failed to fetch current TWAP: ${error.message}`);
    }

    // 2. Fetch price history
    console.log('\n📈 Price History:');
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (interval) params.append('interval', interval);
      
      const priceResponse = await fetch(`${API_URL}/api/history/${proposalId}/prices?${params}`, {
        method: 'GET',
        headers
      });
      
      if (priceResponse.ok) {
        const priceData = await priceResponse.json();
        console.log(`Found ${priceData.count} price records`);
        if (priceData.count > 0) {
          console.log('Sample records:');
          console.log(JSON.stringify(priceData.data.slice(0, 3), null, 2));
          if (priceData.count > 3) {
            console.log(`... and ${priceData.count - 3} more records`);
          }
        }
      } else {
        const error = await priceResponse.json();
        console.log(`❌ Error: ${JSON.stringify(error, null, 2)}`);
      }
    } catch (error: any) {
      console.log(`❌ Failed to fetch price history: ${error.message}`);
    }

    // 3. Fetch trade history
    console.log('\n💹 Trade History:');
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      if (limit) params.append('limit', limit.toString());
      
      const tradeResponse = await fetch(`${API_URL}/api/history/${proposalId}/trades?${params}`, {
        method: 'GET',
        headers
      });
      
      if (tradeResponse.ok) {
        const tradeData = await tradeResponse.json();
        console.log(`Found ${tradeData.count} trade records`);
        if (tradeData.count > 0) {
          console.log('Recent trades:');
          console.log(JSON.stringify(tradeData.data.slice(0, 3), null, 2));
          if (tradeData.count > 3) {
            console.log(`... and ${tradeData.count - 3} more trades`);
          }
        }
      } else {
        const error = await tradeResponse.json();
        console.log(`❌ Error: ${JSON.stringify(error, null, 2)}`);
      }
    } catch (error: any) {
      console.log(`❌ Failed to fetch trade history: ${error.message}`);
    }

    // 4. Fetch TWAP history
    console.log('\n📊 TWAP History:');
    try {
      const params = new URLSearchParams();
      if (from) params.append('from', from);
      if (to) params.append('to', to);
      
      const twapHistoryResponse = await fetch(`${API_URL}/api/history/${proposalId}/twap?${params}`, {
        method: 'GET',
        headers
      });
      
      if (twapHistoryResponse.ok) {
        const twapHistoryData = await twapHistoryResponse.json();
        console.log(`Found ${twapHistoryData.count} TWAP history records`);
        if (twapHistoryData.count > 0) {
          console.log('Sample TWAP records:');
          console.log(JSON.stringify(twapHistoryData.data.slice(0, 3), null, 2));
          if (twapHistoryData.count > 3) {
            console.log(`... and ${twapHistoryData.count - 3} more records`);
          }
        }
      } else {
        const error = await twapHistoryResponse.json();
        console.log(`❌ Error: ${JSON.stringify(error, null, 2)}`);
      }
    } catch (error: any) {
      console.log(`❌ Failed to fetch TWAP history: ${error.message}`);
    }

    // 5. Fetch chart data (if interval provided)
    if (interval) {
      console.log('\n📊 Chart Data:');
      try {
        const params = new URLSearchParams();
        params.append('interval', interval);
        if (from) params.append('from', from);
        if (to) params.append('to', to);
        
        const chartResponse = await fetch(`${API_URL}/api/history/${proposalId}/chart?${params}`, {
          method: 'GET',
          headers
        });
        
        if (chartResponse.ok) {
          const chartData = await chartResponse.json();
          console.log(`Found ${chartData.count} chart data points for ${chartData.interval} interval`);
          if (chartData.count > 0) {
            console.log('Sample chart data:');
            console.log(JSON.stringify(chartData.data.slice(0, 3), null, 2));
            if (chartData.count > 3) {
              console.log(`... and ${chartData.count - 3} more data points`);
            }
          }
        } else {
          const error = await chartResponse.json();
          console.log(`❌ Error: ${JSON.stringify(error, null, 2)}`);
        }
      } catch (error: any) {
        console.log(`❌ Failed to fetch chart data: ${error.message}`);
      }
    }

    console.log('\n✅ Historical data fetch completed');
    
  } catch (error: any) {
    console.error(`❌ Unexpected error: ${error.message}`);
    process.exit(1);
  }
}

// Parse command line arguments
function parseArgs(): FetchOptions {
  const proposalId = process.argv[2];
  
  if (!proposalId) {
    console.error(`Usage: npm run fetch-historical-data <proposal-id> [interval] [limit]

Arguments:
  proposal-id     Required. The proposal ID number
  interval        Optional. Chart interval: 1m, 5m, 15m, 1h, 4h, 1d
  limit          Optional. Limit for trade history (default: 100)

Examples:
  npm run fetch-historical-data 1
  npm run fetch-historical-data 1 1h
  npm run fetch-historical-data 1 1h 50
  npm run fetch-historical-data 1 5m 200

Note: For date filtering, modify the script directly or use the API endpoints`);
    process.exit(1);
  }
  
  const id = parseInt(proposalId);
  if (isNaN(id)) {
    console.error('Invalid proposal ID. Must be a number.');
    process.exit(1);
  }

  const options: FetchOptions = { proposalId: id };
  
  // Parse optional interval
  if (process.argv[3]) {
    const interval = process.argv[3];
    if (!['1m', '5m', '15m', '1h', '4h', '1d'].includes(interval)) {
      console.error(`Invalid interval: ${interval}. Valid values: 1m, 5m, 15m, 1h, 4h, 1d`);
      process.exit(1);
    }
    options.interval = interval;
  }
  
  // Parse optional limit
  if (process.argv[4]) {
    const limit = parseInt(process.argv[4]);
    if (isNaN(limit) || limit <= 0) {
      console.error(`Invalid limit: ${process.argv[4]}. Must be a positive number.`);
      process.exit(1);
    }
    options.limit = limit;
  }
  
  return options;
}

// Run if called directly
if (require.main === module) {
  const options = parseArgs();
  fetchHistoricalData(options);
}

export { fetchHistoricalData };