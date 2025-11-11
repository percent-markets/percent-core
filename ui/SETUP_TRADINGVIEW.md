# TradingView Charting Library Setup

This project uses TradingView's Advanced Charts library, which requires a separate license.

## Getting Access

1. Visit https://www.tradingview.com/advanced-charts/
2. Click "Get Library" and submit the request form
3. TradingView will grant you access to their private GitHub repository
4. This is **FREE** for public-facing web projects

## Installation

Once you have access to TradingView's GitHub repository:

```bash
cd ui
git clone git@github.com:tradingview/charting_library.git public/charting_library
```

This will place the library in `ui/public/charting_library/` where the application expects it.

**Note**: If you have access to a private fork, use that repository URL instead of the official TradingView one.

## Verification

After installation, you should see:
- `ui/public/charting_library/charting_library/` directory exists
- `ui/public/charting_library/package.json` exists

You can verify the installation by running:
```bash
ls ui/public/charting_library/charting_library/
```

You should see files like:
- `charting_library.esm.js`
- `charting_library.d.ts`
- `bundles/` directory
- etc.

## Troubleshooting

### "Permission denied" when running npm install

This means you don't have access to the TradingView GitHub repository yet. Follow the "Getting Access" steps above.

### Charts not displaying

1. Check that `ui/public/charting_library/charting_library/` exists
2. Check browser console for errors
3. Verify the library version matches the one in `package.json` (should be ~30.0.x)

### Postinstall script fails

If the automatic setup fails, use Option 2 (Manual installation) above.

## License

The TradingView Charting Library is proprietary software. See their license agreement at:
https://s3.amazonaws.com/tradingview/charting_library_license_agreement.pdf

**Key Points:**
- Free for public-facing web projects
- Not open source
- Cannot be redistributed
- Must be obtained directly from TradingView

## Version Information

This project is configured to use TradingView Charting Library **v30.x**. The library is backward compatible, so newer 30.x versions should work without issues.

## Support

For issues with the TradingView library itself, contact TradingView support or visit:
- Documentation: https://www.tradingview.com/charting-library-docs/
- GitHub Issues: https://github.com/tradingview/charting_library/issues
