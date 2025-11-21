# Quick Reference: Environment-Based API Configuration

## What Changed?

QRefine now automatically uses the correct backend URL based on environment:
- **Production:** `https://qrefined-backend.onrender.com`
- **Development:** `http://localhost:8000`

## Files Changed

| File | Change |
|------|--------|
| `src/config/environment.ts` | ✨ NEW - Environment configuration utility |
| `src/extension.ts` | Updated to detect environment and log configuration |
| `src/auth/client.ts` | Updated to use `EnvironmentConfig.getApiBaseUrl()` |
| `src/webview/queryPlanWebview.ts` | Updated to use environment-based URL |
| `src/analyzers/queryInterceptor.ts` | Updated to use environment-based URL |

## How It Works

### Automatic at Startup
When extension activates, it:
1. Detects if running in production or development
2. Configures the appropriate base URL
3. Logs the environment and URL

### Manual Override
Set environment variable to force an environment:
```bash
NODE_ENV=production  # Forces production URL
```

## Console Output

Look for this line when extension starts:
```
[QRefine] 🌍 Environment: production | API Base URL: https://qrefined-backend.onrender.com
```

Or for development:
```
[QRefine] 🌍 Environment: development | API Base URL: http://localhost:8000
```

## API URLs by Environment

### Production
```
https://qrefined-backend.onrender.com/auth/register
https://qrefined-backend.onrender.com/auth/login
https://qrefined-backend.onrender.com/auth/validate
https://qrefined-backend.onrender.com/analysis
```

### Development
```
http://localhost:8000/auth/register
http://localhost:8000/auth/login
http://localhost:8000/auth/validate
http://localhost:8000/analysis
```

## Using in Code

```typescript
import { EnvironmentConfig } from "./config/environment";

// Get the base URL
const baseUrl = EnvironmentConfig.getApiBaseUrl();

// Use it in API calls
const response = await fetch(`${baseUrl}/analysis`, {...});

// Check environment
if (EnvironmentConfig.isProduction()) {
  // Production-specific logic
}
```

## Testing

### Development Mode (F5)
- Extension runs with `http://localhost:8000`
- Make sure backend is running locally

### Production Mode
- Extension runs with `https://qrefined-backend.onrender.com`
- Backend must be deployed on Render

## Compilation

```bash
npm run compile
# ✅ All files compile with 0 TypeScript errors
```

## Status

✅ **COMPLETE** - All changes implemented and tested
✅ **TYPE-SAFE** - Full TypeScript support
✅ **PRODUCTION-READY** - Ready for deployment

## Next Steps

1. **Development:** Ensure backend is running on `http://localhost:8000`
2. **Production:** Verify backend is deployed to `https://qrefined-backend.onrender.com`
3. **Deploy:** Use `npm run package` to publish the extension

## Need More Details?

See `ENVIRONMENT_CONFIG.md` for comprehensive documentation.
