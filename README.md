# Urenregistratie Calculator

A professional hour tracking and payment calculation application built with React, TypeScript, and Tailwind CSS.

## Features

- **Profile Management**: Create and manage employee profiles with hourly rates and deductions
- **Hour Tracking**: Log hours worked with date, profile, and description
- **Real-time Calculations**: Automatic calculation of gross, net, and client payments
- **PDF Export**: Generate professional PDF reports for clients and accounting
- **Data Import/Export**: Backup and restore data with JSON files
- **Responsive Design**: Works perfectly on desktop and tablet devices
- **Local Storage**: Data persists between sessions

## Technology Stack

- **Frontend**: React 19 with TypeScript
- **Styling**: Tailwind CSS with custom design system
- **Build Tool**: Vite
- **PDF Generation**: jsPDF
- **Icons**: Lucide React
- **Deployment**: Vercel

## Getting Started

### Prerequisites

- Node.js 20.19+ or 22.12+
- npm or yarn

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm run dev
   ```

4. Open [http://localhost:5173](http://localhost:5173) in your browser

### Building for Production

```bash
npm run build
```

The built files will be in the `dist` directory.

## Usage

1. **Create Profiles**: Add employee profiles with names, hourly rates, and deduction types
2. **Log Hours**: Input hours worked for each profile on specific dates
3. **View Calculations**: See real-time calculations for gross, net, and client payments
4. **Export Reports**: Generate PDF reports or backup data as JSON files
5. **Import Data**: Restore previous data from JSON backup files

## Deployment

This project is configured for easy deployment on Vercel:

1. Push your code to GitHub
2. Connect your repository to Vercel
3. Deploy automatically

The `vercel.json` configuration file is included for optimal deployment settings.

## License

This project is private and proprietary.