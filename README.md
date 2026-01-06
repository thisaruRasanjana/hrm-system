# HRM System

A Human Resource Management system built using:
- FastAPI backend
- Next.js frontend
- Separate AI service for CV parsing and scoring

## Project Structure

backend/      - HRM backend (FastAPI)  
frontend/     - Web frontend (Next.js)  
ai-service/   - Internal AI service (FastAPI)

## Architecture

- Modular monolithic backend
- Separate AI service
- PostgreSQL database
- JWT authentication with RBAC