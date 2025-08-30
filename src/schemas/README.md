# Schema Registry - Super Simple API

The Schema Registry eliminates brittle tRPC v11 schema extraction with an **ultra-simple API**.

## 🚀 **Super Simple Usage**

### Method 1: The `input()` Function (Clearest!)

```typescript
import { z } from 'zod';
import { input } from './schemas/schema-registry.js';

// Define input schema - wraps your Zod schema with auto-registration
const userSchema = input(z.object({
  name: z.string().min(1),
  email: z.string().email()
}));

// Use directly in tRPC - no ID needed!
const router = createTRPCRouter({
  createUser: publicProcedure
    .input(userSchema)  // That's it! ✨
    .mutation(({ input }) => {
      // Fully typed, auto-registered for MCP
    })
});
```

### Method 2: With Custom ID (When You Need Control)

```typescript
import { input } from './schemas/schema-registry.js';

const userSchema = input(
  z.object({
    name: z.string(),
    email: z.string().email()
  }),
  'user.create'  // Custom ID (optional)
);
```

### Method 3: Short Alias `s()` (Same as `input()`)

```typescript
import { s } from './schemas/schema-registry.js';

// s() is just an alias for input()
const userSchema = s(z.object({
  name: z.string(),
  email: z.string().email()
}));
```

### Method 3: Full Control (Advanced)

```typescript
import { defineSchema } from './schemas/schema-registry.js';

const userSchema = defineSchema(
  z.object({ name: z.string(), email: z.string().email() }),
  {
    id: 'user.create',
    name: 'User Creation',
    description: 'Schema for user creation endpoint',
    category: 'user'
  }
);
```

## ✅ **What You Get Automatically**

- ✅ **Auto-Detection**: Zod/Yup/Joi automatically detected
- ✅ **Auto-Registration**: Schema registered in global registry
- ✅ **Auto-MCP**: Works with MCP tools without extra config
- ✅ **Auto-Types**: Full TypeScript support
- ✅ **Auto-JSON Schema**: Converted for API documentation

## 🎯 **MCP Integration**

Your schema automatically becomes an MCP tool when used with tRPC:

```typescript
const greetingSchema = input(z.object({
  name: z.string().default("World"),
  language: z.enum(["en", "es", "fr"]).default("en")
}), 'greeting');

// Use in tRPC router
const router = createTRPCRouter({
  greeting: publicProcedure
    .meta({
      mcp: { 
        title: "Greeting Tool", 
        description: "Generate greetings" 
      }
    })
    .input(greetingSchema)
    .query(({ input }) => `Hello ${input.name}!`)
});

// Automatically available via MCP protocol at /mcp endpoint!
```

## 🔧 **Validator Support**

### Zod (Primary - Auto-detected)
```typescript
const schema = input(z.object({ name: z.string() }));
```

### Yup (Future support)
```typescript
import * as yup from 'yup';
// Note: Currently only Zod is fully supported
// Yup support coming soon with adapter
```

### Joi (Future support)
```typescript
import joi from 'joi';
// Note: Currently only Zod is fully supported  
// Joi support coming soon with adapter
```

## 📋 **Real Examples**

```typescript
// Example 1: Simple validation
const loginSchema = input(z.object({
  email: z.string().email(),
  password: z.string().min(8)
}));

// Example 2: With custom ID  
const profileSchema = input(z.object({
  name: z.string(),
  age: z.number().min(0).max(150)
}), 'user.profile');

// Example 3: Complex validation
const orderSchema = input(z.object({
  items: z.array(z.object({
    productId: z.string(),
    quantity: z.number().positive()
  })).min(1),
  shipping: z.object({
    address: z.string(),
    method: z.enum(['standard', 'express'])
  })
}), 'order.create');
```

## 🚫 **What You DON'T Need Anymore**

❌ ~~Complex schema extraction~~  
❌ ~~Manual registration~~  
❌ ~~Brittle tRPC internals~~  
❌ ~~Separate MCP configuration~~  
❌ ~~Multiple schema definitions~~  

## 🔄 **Migration**

### Before (Complex)
```typescript
const SCHEMA_ID = defineSchema(
  'user.profile',
  'User Profile', 
  'User profile schema',
  z.object({ name: z.string() }),
  { category: 'user' }
);

const procedure = publicProcedure
  .meta({ schemaId: SCHEMA_ID })
  .input(schema(SCHEMA_ID))
  .mutation(({ input }) => { ... });
```

### After (Simple)
```typescript
const userSchema = input(z.object({ name: z.string() }));

const procedure = publicProcedure
  .input(userSchema)  // That's it!
  .mutation(({ input }) => { ... });
```

## 🛠️ **Advanced Features**

Access the registry when needed:
```typescript
import { schemaRegistry } from './schema-registry.js';

// List all schemas
const schemas = schemaRegistry.list();

// Get JSON Schema for MCP
const jsonSchema = schemaRegistry.getJsonSchema('user.profile');

// Manual validation
const result = schemaRegistry.safeValidate('user.profile', input);
```

---

**TL;DR**: Use `input(yourZodSchema)` and everything works automatically! 🎉