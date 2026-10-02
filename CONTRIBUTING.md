# Contribution Guidelines

Thank you for your interest in contributing to ONE-DELUX!

## How to Contribute

### Reporting Bugs

Before creating bug reports, please check the existing issues to avoid duplicates. If you find an existing issue, add a comment with additional information.

When creating a bug report:
- Use the bug report template
- Provide clear steps to reproduce
- Include your environment details (OS, Node.js version, etc.)
- Add relevant logs or screenshots

### Suggesting Enhancements

Enhancement suggestions are welcome! Use the feature request template and:
- Describe the problem you're trying to solve
- Explain why this enhancement would be useful
- Consider alternative solutions

### Pull Requests

1. Fork the repository
2. Create a branch for your feature (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Follow the code style guidelines
5. Add tests if applicable
6. Update documentation if needed
7. Commit your changes (`git commit -m 'Add amazing feature'`)
8. Push to the branch (`git push origin feature/amazing-feature`)
9. Open a Pull Request

## Development Setup

```bash
# Clone the repository
git clone <your-fork-url>
cd bug-free-octo-sniffle-main

# Install dependencies
npm install

# Configure environment variables
cp .env.example .env
# Edit .env with your configuration

# Start the development server
npm run dev

# Run syntax checks
npm run check:server

# Run tests
npm test

# Run linting
npm run lint
```

## Code Style

- Follow existing code conventions
- Use meaningful variable and function names
- Add comments for complex logic
- Keep functions focused and small
- Run `npm run lint` before committing

## Testing

- Write tests for new features
- Ensure all tests pass before submitting PR
- Use Playwright for E2E tests
- Test on multiple browsers when applicable

## Documentation

- Update README.md if you change user-facing features
- Update inline code comments
- Add JSDoc comments for public functions
- Keep documentation in French (project language)

## Project Structure

```
.
├── server/              # Backend routes and logic
├── services/           # Business logic services
├── public/             # Frontend assets
├── docs/               # Documentation
├── tests/              # Test files
├── .github/            # GitHub configurations
└── server.js           # Main entry point
```

## Getting Help

- Open an issue for questions
- Check existing documentation
- Review the README.md
- Refer to ANDROID_INTEGRATION_GUIDE.md for mobile development

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
