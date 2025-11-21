# QRefine Development Quick Start

## Getting Started

### Prerequisites
- Node.js 18+
- npm 9+
- VS Code 1.103.0+

### Setup

```bash
# Clone and install
git clone https://github.com/miteshrvasoya/qrefine.git
cd qrefine
npm install

# Start development (auto-recompile on changes)
npm run watch

# Run tests
npm run test

# Lint code
npm run lint
```

### Project Structure

```
src/
├── auth/                    # Authentication system
│   ├── manager.ts          # Auth coordinator
│   ├── webview.ts          # Login/signup UI
│   ├── storage.ts          # Secure token storage
│   ├── client.ts           # Backend API client
│   ├── api.ts              # HTTP helper with auth
│   └── types.ts            # TypeScript interfaces
│
├── analyzers/
│   └── queryInterceptor.ts # Runtime query capture
│
├── rules/                   # SQL analysis rules
├── utils/
│   └── sqlExtractors.ts    # Improved query extraction
├── webview/
│   └── queryPlanWebview.ts # Query visualization
│
├── extension.ts            # Entry point
├── staticAnalyzer.ts       # Rule orchestration
└── types.ts               # Type definitions

media/
└── qrefine-plan.html      # Query plan visualizer UI

docs/
├── AUTHENTICATION_README.md   # Auth system guide
├── SQL_EXTRACTION_GUIDE.md    # Query extraction guide
├── IMPLEMENTATION_SUMMARY.md  # Overall summary
└── .github/copilot-instructions.md
```

## Development Workflow

### 1. Making Changes

```bash
# Make your changes in src/
# TypeScript auto-compiles to dist/

# Watch terminal shows:
# "npm run watch" running in background ✅
```

### 2. Testing Changes

```bash
# Open VS Code
# Press F5 to open Extension Development Host
# Test your changes in the dev window

# Run tests
npm run test

# Check linting
npm run lint
```

### 3. Common Tasks

#### Add a New SQL Rule
1. Create `src/rules/myNewRule.ts`
2. Implement `SQLRule` interface
3. Add to `src/rules/index.ts`

#### Modify Authentication Flow
1. Edit `src/auth/webview.ts` for UI
2. Edit `src/auth/manager.ts` for logic
3. Update `src/extension.ts` for integration

#### Improve Query Extraction
1. Edit `src/utils/sqlExtractors.ts`
2. Add/modify extraction functions
3. Test with sample files

#### Add API Integration
1. Use `AuthAPI` class instead of `fetch()`
2. It automatically adds auth headers
3. Example: `await authAPI.post('/analysis', { query })`

## Key Concepts

### Authentication
- **Storage**: VS Code's encrypted `secretStorage`
- **Token**: JWT bearer token
- **Status Bar**: Shows login/logout button with username
- **API**: All calls include `Authorization: Bearer <token>`

### SQL Extraction
- **Three Types**:
  - `complete` - Full static SQL
  - `template` - Template literals with `${}`
  - `dynamic` - String concatenation (runtime capture)
- **Confidence**: 0-100% score for each query
- **Validation**: Checks for SQL keywords and structure

### Query Interception
- **Purpose**: Capture dynamic SQL at runtime
- **Methods**:
  - Middleware (backend)
  - Decorator (@InterceptQuery)
  - Manual (explicit capture)
- **Storage**: In-memory (max 100 queries)

## Debugging

### Debug Mode
```bash
# Press F5 in VS Code to start debug session
# Extension runs in VS Code dev window
# Console logs appear in Output panel
```

### Check Logs
```
View → Output → QRefine (or relevant channel)
```

### Common Issues

**Extension not loading?**
- Check `npm run compile` output
- Verify no TypeScript errors
- Check `npm run lint`

**Auth not working?**
- Ensure backend running at `http://127.0.0.1:8000`
- Check auth endpoints exist
- Verify token in VS Code secretStorage

**Queries not detected?**
- Check sqlExtractors confidence score
- Verify SQL starts with recognized keyword
- Check file is .ts, .js, or .sql

**API calls failing?**
- Check token exists in secretStorage
- Verify Bearer token in request headers
- Check backend response status

## Making a Pull Request

1. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature
   ```

2. **Make changes**
   ```bash
   # Edit files in src/
   npm run watch  # Running in background
   ```

3. **Test thoroughly**
   ```bash
   npm run compile
   npm run lint
   npm run test
   ```

4. **Commit with clear messages**
   ```bash
   git commit -m "feat: add login/signup authentication"
   ```

5. **Push and create PR**
   ```bash
   git push origin feature/your-feature
   ```

## File Size & Performance

Current metrics:
- **Extension Size**: ~2.5 MB installed
- **Memory Usage**: +15-20 MB when running
- **Query Analysis**: <500ms for files up to 10k lines
- **Startup Time**: <2s from click to webview open

## Release Process

```bash
# Update version
npm run bump

# Compile and lint
npm run compile
npm run lint

# Package for VS Code Marketplace
npm run package

# This generates .vsix file for distribution
```

## Useful Resources

- [VS Code API Docs](https://code.visualstudio.com/api)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ES2020 Features](https://www.typescriptlang.org/docs/handbook/release-notes/typescript-3-9.html)
- [SQL Best Practices](https://use-the-index-luke.com/)

## Architecture Decisions

### Why secureStorage?
- Tokens must be encrypted
- OS-level storage is most secure
- Browser localStorage equivalent doesn't exist
- Automatically cleared on uninstall

### Why AuthAPI wrapper?
- DRY - Don't repeat auth logic
- Centralized token management
- Easy to add refresh logic later
- Consistent error handling

### Why three extraction methods?
- **Static**: Catches most cases, fast
- **Decorator**: Explicit, works in backend
- **Manual**: Flexible, explicit control
- Together: Cover all query patterns

## Performance Tips

1. **Avoid analyzing huge files**
   - Set limit in `sqlExtractors.ts`
   - Skip non-code files

2. **Cache query results**
   - QueryInterceptor keeps last 100
   - Consider DB caching for repeats

3. **Use confidence filtering**
   - Only analyze high-confidence queries
   - Reduces false positives

## Security Checklist

- [ ] Never log passwords
- [ ] Always use HTTPS in production
- [ ] Validate tokens on backend
- [ ] Check user_id matches authenticated user
- [ ] Rate limit auth endpoints
- [ ] Use secure CORS headers
- [ ] Implement token expiration
- [ ] Hash queries in logs

## Next Steps

1. **Set up backend auth endpoints** (if not done)
2. **Implement query interceptor** on backend
3. **Test end-to-end** auth flow
4. **Deploy to marketplace** when ready
5. **Monitor for issues** and iterate

## Getting Help

- **Bugs**: Open GitHub issue with reproduction steps
- **Questions**: Check existing issues/discussions
- **Feature Requests**: Create issue with use case
- **Security**: Don't open public issue, contact maintainer

---

**Happy coding! 🚀**
