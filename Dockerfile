# Official Playwright Docker image matching installed Playwright version 1.65.0
FROM mcr.microsoft.com/playwright:v1.65.0-noble

# Environment settings
ENV NODE_ENV=production \
    PORT=7860

# Set working directory
WORKDIR /app

# Ensure proper ownership for pwuser (UID 1000)
RUN chown -R pwuser:pwuser /app

# Switch to non-root user with UID 1000
USER pwuser

# Copy package specifications
COPY --chown=pwuser:pwuser package*.json ./

# Install dependencies
RUN npm install

# Copy application source code and configuration
COPY --chown=pwuser:pwuser tsconfig.json ./
COPY --chown=pwuser:pwuser src ./src

# Expose port 7860 (Hugging Face Spaces default port)
EXPOSE 7860

# Launch TestPilot Runner
CMD ["npx", "tsx", "src/server.ts"]
