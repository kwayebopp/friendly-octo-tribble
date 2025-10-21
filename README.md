# Hyperdrip - Lead Drip Campaign Service

A Next.js application that manages lead drip campaigns with daily quota enforcement and message queuing using PostgreSQL Message Queue (PGMQ).

## Overview

Hyperdrip allows marketing teams to automatically send messages to leads over multiple days while respecting daily send limits. Each lead receives a configurable number of messages (default: 5) spread across consecutive days, with intelligent queue management to handle capacity overflow.

## Features

- **Lead Management**: Simple form to capture lead information (name, email, phone, notes)
- **Drip Campaigns**: Automatic message scheduling across multiple days
- **Daily Quota**: Configurable daily message limits to prevent over-sending
- **Queue Management**: Date-tagged queues for organized message processing
- **Capacity Overflow**: Automatic scheduling to next available day when quota is reached
- **Concurrency Safety**: Prevents duplicate message sends with transaction safety

## Architecture

### Core Components

1. **Frontend Form** (`src/app/page.tsx`): React form for lead submission
2. **API Endpoint** (`src/app/api/leads/route.ts`): Handles lead creation and quota management
3. **Queue System** (`src/lib/queue.ts`): PGMQ wrapper for message queuing
4. **Database** (PostgreSQL + Prisma): Lead storage and drip tracking
5. **Message Queue** (PGMQ): Reliable message processing

### Drip Service Flow

```
Lead Submission → Quota Check → Queue Scheduling → Message Processing
```

1. **Lead Creation**: User submits form with contact information
2. **Quota Analysis**: System checks daily message capacity
3. **Queue Scheduling**: Messages distributed across date-tagged queues
4. **Message Processing**: Background worker processes queued messages
5. **Delivery Tracking**: Messages marked as sent with timestamps

## Setup Instructions

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- npm or yarn

### Environment Variables

Sample environment files are provided for both development and testing. Copy them to create your environment configuration:

```bash
# Copy sample files
cp .sample.env .env
cp .sample.env.test .env.test
```

The `.env` file should contain:

```bash
# Database
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/hyperdrip"

# Drip Service Configuration
DAILY_MAX=100

# PGMQ Configuration (optional)
PGMQ_URL="http://localhost:8080/api/v1"
```

### Quick Start

1. **Clone and install dependencies:**
   ```bash
   git clone <repository-url>
   cd hyperdrip
   npm install
   ```

2. **Set up environment files:**
   ```bash
   cp .sample.env .env
   cp .sample.env.test .env.test
   ```

3. **Start the infrastructure:**
   ```bash
   # Start PostgreSQL + PGMQ services
   npm run docker:up
   ```

4. **Set up the database:**
   ```bash
   # Run database migrations
   npx prisma migrate deploy
   ```

5. **Start the development server:**
   ```bash
   npm run dev
   ```

6. **Open the application:**
   - Frontend: http://localhost:3000
   - PGMQ API: http://localhost:8080

### Docker Services

The application uses Docker Compose for infrastructure:

```yaml
services:
  db:          # PostgreSQL with PGMQ extension
  queue:       # PGMQ REST API service
```

**Available Docker commands:**
- `npm run docker:up` - Start all services
- `npm run docker:down` - Stop all services
- `npm run docker:db` - Start only database
- `npm run docker:queue` - Start only queue service

## How the Drip Service Works

### 1. Lead Ingestion

When a lead is submitted via the form:

```typescript
// Lead data structure
{
  name: "John Doe",
  email: "john@example.com",
  phone: "555-1234",
  notes: "Interested in product",
  maxMessages: 5,        // Default: 5 messages
  messageCount: 0,       // Messages sent so far
  status: "ACTIVE"       // Lead status
}
```

### 2. Quota Management

The system enforces daily message limits:

- **Daily Max**: Configurable via `DAILY_MAX` environment variable (default: 100)
- **Capacity Check**: Counts messages sent today across ALL leads
- **Overflow Handling**: If today is at capacity, schedules for next available day

```typescript
// Quota algorithm
const todayMessageCount = await prisma.lead.count({
  where: {
    lastSentAt: {
      gte: today,
      lt: tomorrow
    }
  }
});

if (todayMessageCount < DAILY_MAX) {
  // Schedule for today
} else {
  // Find next available day
}
```

### 3. Queue Architecture

Messages are organized in date-tagged queues:

```
drip-messages-2024-01-15  # Messages for January 15th
drip-messages-2024-01-16  # Messages for January 16th
drip-messages-2024-01-17  # Messages for January 17th
```

**Message Format:**
```json
{
  "leadId": "lead_123",
  "email": "user@example.com",
  "messageNumber": 1,
  "scheduledDate": "2024-01-15"
}
```

### 4. Message Scheduling

For each lead, the system schedules multiple messages:

```typescript
// Example: Lead created on Jan 15th
// Message 1: Scheduled for Jan 15th (today)
// Message 2: Scheduled for Jan 16th
// Message 3: Scheduled for Jan 17th
// Message 4: Scheduled for Jan 18th
// Message 5: Scheduled for Jan 19th
```

### 5. Concurrency Safety

The system prevents duplicate message sends through:

- **PGMQ Visibility Timeout**: Messages become invisible to other workers for 30 seconds
- **Database Transactions**: Atomic updates to prevent race conditions
- **Message Count Validation**: Ensures `messageCount` matches expected `messageNumber`

```typescript
// Duplicate prevention
const lead = await prisma.lead.findUnique({ where: { id: leadId } });
if (lead.messageCount === messageNumber) {
  // Safe to send - increment counter
  await prisma.lead.update({
    where: { id: leadId },
    data: {
      messageCount: messageCount + 1,
      lastSentAt: new Date()
    }
  });
}
```

## API Endpoints

### POST /api/leads

Creates a new lead and schedules drip messages.

**Request:**
```json
{
  "name": "John Doe",
  "email": "john@example.com",
  "phone": "555-1234",
  "notes": "Interested in product"
}
```

**Response:**
```json
{
  "success": true,
  "message": "Lead submitted successfully",
  "data": {
    "id": "lead_123",
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "555-1234",
    "notes": "Interested in product",
    "maxMessages": 5,
    "status": "ACTIVE",
    "createdAt": "2024-01-15T10:30:00Z"
  }
}
```

## Database Schema

### Lead Model

```prisma
model Lead {
  id               String    @id @default(cuid())
  name             String
  email            String    @unique
  phone            String    @unique
  notes            String?
  maxMessages      Int       @default(5)
  messageCount     Int       @default(0)
  lastSentAt       DateTime?
  nextScheduledFor DateTime?
  status           LeadStatus @default(ACTIVE)
  createdAt        DateTime  @default(now())

  @@index([nextScheduledFor, status])
}

enum LeadStatus {
  ACTIVE
  COMPLETED
  FAILED
}
```

## Development

### Running Tests

```bash
# Run all tests
npm test

# Run tests with database setup
npm run docker:up && npx prisma migrate deploy && npm test
```

### Database Management

```bash
# Reset database
npx prisma migrate reset

# View database in Prisma Studio
npx prisma studio

# Generate Prisma client
npx prisma generate
```

### Queue Management

```bash
# View queue metrics
curl http://localhost:8080/api/v1/metrics

# Create a test queue
curl -X POST http://localhost:8080/api/v1/create \
  -H "Content-Type: application/json" \
  -d '{"queue_name": "test-queue"}'
```

## Production Considerations

### Environment Variables

```bash
# Production database
DATABASE_URL="postgresql://user:password@prod-db:5432/hyperdrip"

# Production queue limits
DAILY_MAX=1000

# Production PGMQ
PGMQ_URL="http://prod-pgmq:8080/api/v1"
```

### Scaling

- **Database**: Use connection pooling for high-volume scenarios
- **Queue Processing**: Run multiple worker instances for parallel processing
- **Monitoring**: Track queue metrics and database performance
- **Error Handling**: Implement retry logic for failed message processing

### Security

- Use environment variables for sensitive configuration
- Implement rate limiting on API endpoints
- Use HTTPS in production
- Regular security updates for dependencies

## Troubleshooting

### Common Issues

1. **Database Connection Errors**
   - Ensure PostgreSQL is running: `docker ps`
   - Check DATABASE_URL format
   - Verify database exists: `psql -h localhost -U postgres -d hyperdrip`

2. **Queue Connection Errors**
   - Ensure PGMQ service is running: `curl http://localhost:8080/api/v1/metrics`
   - Check PGMQ_URL configuration
   - Verify queue creation: `curl -X POST http://localhost:8080/api/v1/create -H "Content-Type: application/json" -d '{"queue_name": "test"}'`

3. **Migration Issues**
   - Reset database: `npx prisma migrate reset`
   - Check migration files in `prisma/migrations/`
   - Regenerate client: `npx prisma generate`

## Drip Worker Service

The drip worker automatically starts when the Next.js application starts and processes queued messages in the background.

### Worker Operation

- **Auto-start**: Worker starts automatically with Next.js server via `instrumentation.ts`
- **Queue Processing**: Only processes today's queue (`drip-messages-YYYY-MM-DD`, or `test-drip-messages-YYYY-MM-DD` in test mode)
- **Efficient Polling**: Uses `readMessagesWithPoll` for database-level polling (5s max wait, 100ms intervals)
- **Duplicate Prevention**: Checks `messageCount === messageNumber - 1` before processing
- **Message Spacing**: 2-second delay between message sends (configurable via `WORKER_MESSAGE_DELAY`)
- **Graceful Shutdown**: Handles SIGTERM/SIGINT for clean shutdown

### Worker Configuration

Add these environment variables to your `.env` file:

```bash
# Worker Configuration
WORKER_POLL_INTERVAL=5000  # milliseconds between queue polls
WORKER_MESSAGE_DELAY=2000  # delay between message sends (milliseconds)
```

### Message Processing Flow

1. **Queue Polling**: Worker polls today's queue using `readMessagesWithPoll`
2. **Duplicate Check**: Verifies `lead.messageCount === messageNumber - 1`
3. **Message Sending**: Simulates send with `console.log` output
4. **Database Update**: Atomically updates `messageCount`, `lastSentAt`, `status`
5. **Queue Cleanup**: Archives message only after successful database update
6. **Error Handling**: Leaves failed messages in queue for retry

### Test Mode

When running tests (`NODE_ENV=test` or `NEXT_PHASE=test`), queue names are automatically prefixed with `test-`:

- **Production**: `drip-messages-2024-01-15`
- **Test**: `test-drip-messages-2024-01-15`

This ensures test data is isolated from production queues.

### Worker Logs

The worker outputs detailed logs for monitoring:

```
Starting drip worker...
Drip worker started - polling every 5000ms
Sending message #1 to user@example.com (scheduled for 2024-01-15)
Sending message #2 to user@example.com (scheduled for 2024-01-16)
Lead user@example.com completed drip campaign (5/5 messages)
```

### Logs

```bash
# View application logs
npm run dev

# View Docker logs
docker-compose logs db
docker-compose logs queue
```

## License

MIT License - see LICENSE file for details.
