# BeautifyAI - AI-Powered Document Enhancement Platform

BeautifyAI is an AI-powered platform that automatically enhances and beautifies educational worksheets and business documents. Using advanced vision AI models, the platform analyzes design flaws and applies intelligent enhancements to create visually appealing, pedagogically sound, and professional-looking documents.

## 🚀 Tech Stack

- **Frontend**: Next.js 14 with TypeScript
- **UI**: Tailwind CSS + Shadcn/ui
- **State Management**: Zustand + React Query (TanStack Query)
- **Authentication**: Supabase Auth
- **Database**: PostgreSQL via Supabase
- **File Storage**: Cloudflare R2
- **AI Models**:
  - Vision: Gemini 2.0 Flash, GPT-4.1 Mini, Claude 3.5/4 Sonnet
  - Image Generation: Stable Diffusion XL, DALL-E 3
- **Queue System**: BullMQ with Redis
- **Real-time**: Socket.io
- **Payment**: Stripe

## 🛠️ Installation

1. Clone the repository:

```bash
git clone https://github.com/yourusername/canva-beautifying.git
cd canva-beautifying
```

2. Install dependencies:

```bash
npm install
```

3. Set up environment variables:

```bash
cp .env.example .env.local
```

4. Run the development server:

```bash
npm run dev
```

Open [http://localhost:5000](http://localhost:5000) to see the application.

## 📝 Project Structure

```
canva-beautifying/
├── app/                    # Next.js app directory
├── components/            # React components
│   └── ui/               # Shadcn/ui components
├── lib/                   # Utility functions
├── public/                # Static assets
├── .taskmaster/          # TaskMaster project files
│   ├── docs/            # Documentation (PRD)
│   └── tasks/           # Task definitions
└── ...
```

## 🎯 Features

- **Document Upload**: Drag-and-drop support for PNG, JPG, and PDF
- **AI Analysis**: Automatic detection of design issues
- **Smart Enhancement**: AI-powered improvements to layout, colors, and typography
- **Multiple Export Formats**: PNG, JPG, PDF, and Canva-compatible
- **Batch Processing**: Handle up to 10 documents at once
- **Real-time Progress**: Live updates during enhancement
- **Subscription Tiers**: Free, Basic, Pro, and Premium plans

## 🔧 Development

### Running Tests

```bash
npm test
```

### Building for Production

```bash
npm run build
```

### Linting

```bash
npm run lint
```

## 📄 License

This project is licensed under the MIT License.
