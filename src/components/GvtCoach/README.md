# GVT Coach Component

This component encapsulates all GVT Coach functionality into a single React component that can be integrated into any Next.js application.

## Installation

```bash
# If you're using npm
npm install ./path/to/gvt-coach-component

# If you're using yarn
yarn add ./path/to/gvt-coach-component
```

## Usage

```jsx
import { GvtCoach } from 'gvt-coach-component';

export default function YourApp() {
  return (
    <div>
      <h1>My Application</h1>
      
      {/* Integrate GVT Coach with custom configuration */}
      <GvtCoach 
        supabaseUrl="https://your-supabase-url.supabase.co"
        supabaseAnonKey="your-supabase-anon-key"
        customConfig={{
          theme: 'dark', // 'light', 'dark', or 'system'
          // Other custom configurations
        }}
      />
    </div>
  );
}
```

## Properties

| Property | Type | Description |
|-----------|------|-------------|
| `supabaseUrl` | string | URL of your Supabase project |
| `supabaseAnonKey` | string | Supabase anonymous key |
| `customConfig` | object | Custom configurations like theme |

## Requirements

This component requires your project to have the following dependencies:

- React 19+
- Next.js 15+
- next-themes
- @supabase/auth-helpers-nextjs

## Customization

You can customize the appearance and behavior of the component through the `customConfig` property.

## License

MIT 