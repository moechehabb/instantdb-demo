---
trigger: always_on
---

You are an expert developer who writes full-stack apps in InstantDB, Next.js, and Tailwind developer. However InstantDB is not in your training set and you are not familiar with it. Before you write ANY code make sure you read ALL of context in this file to understand how to use InstantDB in your code. If you are unsure how something works in InstantDB you fetch the urls in the documentation.

Before generating a new next app you check to see if a next project already exists in the current directory. If it does you do not generate a new next app.

If the Instant MCP is available use the tools to create apps and manage schema and permissions.

# About InstantDB

Instant is the Modern Firebase. With Instant you can easily build realtime and
collaborative apps. You can get started for free at https://instantdb.com

# How to use Instant in projects

Instant offers client side javascript packages for vanilla JS, react,
and react native. Instant also offers a javascript admin SDK that can be used on
the backend.

If you want to use Instant with react you should only use `@instantdb/react`. For react-native you should
only use `@instantdb/react-native`. For the admin SDK you should only use
`@instantdb/admin`. For other client-side frameworks or vanilla js you should only use `@instantdb/core`

You cannot use Instant on the backend outside of the admin SDK at the moment.

# Full Example App

Below is a full demo app built with InstantDB, Next.js, and TailwindCSS with the following features:

- Initiailizes a connection to InstantDB
- Defines schema and permissions for the app
- Authentication with magic codes
- Reads and writes data via `db.useQuery` and `db.transact`
- Ephemeral features like who's online and shout
- File uploads for avatars

Logic is split across four files:

- `lib/db.ts` -- InstantDB client setup
- `instant.schema.ts` - InstantDB schema, gives you type safety for your data!
- `instant.perms.ts` - InstantDB permissions, not required for this app, but we still included to show how to restrict access to your data.
- `app/page.tsx` - Main logic, mostly UI with some Instant magic :)

```typescript
/* FILE: lib/db.ts */
import { init } from '@instantdb/react';
import schema from "../instant.schema"

const APP_ID = process.env.NEXT_PUBLIC_INSTANT_APP_ID!;
const db = init({ appId: APP_ID, schema });

export default db;

/* FILE: instant.schema.ts */
import { i } from "@instantdb/react";

const _schema = i.schema({
  entities: {
    $files: i.entity({
      path: i.string().unique().indexed(),
      url: i.string(),
    }),
    $users: i.entity({
      email: i.string().unique().indexed().optional(),
    }),
    profiles: i.entity({
      handle: i.string(),
    }),
    posts: i.entity({
      text: i.string(),
      // IMPORTANT: DO NOT USE i.date() FOR DATES, USE i.number() INSTEAD
      // InstantDB stores dates as timestamps (milliseconds since epoch)
      createdAt: i.number().indexed(),
    }),
  },
  links: {
    userProfiles: {
      forward: { on: "profiles", has: "one", label: "user" },
      reverse: { on: "$users", has: "one", label: "profile" },
    },
    postAuthors: {
      forward: { on: "posts", has: "one", label: "author", required: true },
      reverse: { on: "profiles", has: "many", label: "posts" },
    },
    profileAvatars: {
      forward: { on: "profiles", has: "one", label: "avatar" },
      reverse: { on: "$files", has: "one", label: "profile" },
    }
  },
  rooms: {
    todos: {
      presence: i.entity({}),
      topics: {
        shout: i.entity({
          text: i.string(),
          x: i.number(),
          y: i.number(),
          angle: i.number(),
          size: i.number(),
        })
      },
    }
  },
});

// This helps Typescript display nicer intellisense
type _AppSchema = typeof _schema;
interface AppSchema extends _AppSchema { }
const schema: AppSchema = _schema;

export type { AppSchema };
export default schema;

/* FILE: instant.perms.ts */
import type { InstantRules } from "@instantdb/react";

const rules = {
  $files: {
    allow: {
      view: "true",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    bind: ["isOwner", "auth.id != null && data.path.startsWith(auth.id + '/')"]
  },
  profiles: {
    allow: {
      view: "true",
      create: "isOwner",
      update: "isOwner",
      delete: "false",
    },
    bind: ["isOwner", "auth.id != null && auth.id == data.id"]
  },
  posts: {
    allow: {
      view: "true",
      create: "isOwner",
      update: "isOwner",
      delete: "isOwner",
    },
    // IMPORTANT: data.ref returns an array so we MUST use `in`
    bind: ["isOwner", "auth.id in data.ref('author.id')"]
  }
} satisfies InstantRules;

export default rules;

/* FILE: app/page.tsx */
"use client";

import React, { useState, useEffect } from "react";
import { id, lookup, InstaQLEntity, User } from "@instantdb/react";

import db from "../lib/db";
import schema from "../instant.schema";

// Instant utility types for query results
type ProfileWithAvatar = InstaQLEntity<typeof schema, "profiles", { avatar: {} }>;
type PostsWithProfile = InstaQLEntity<typeof schema, "posts", { author: { avatar: {} } }>;

function randomHandle() {
  const adjectives = ["Quick", "Lazy", "Happy", "Sad", "Bright", "Dark"];
  const nouns = ["Fox", "Dog", "Cat", "Bird", "Fish", "Mouse"];
  const randomAdjective = adjectives[Math.floor(Math.random() * adjectives.length)];
  const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];
  const randomSuffix = Math.floor(Math.random() * 9000) + 1000
  return `${randomAdjective}${randomNoun}${randomSuffix}`;
}

// Write Data
// ---------
async function createProfile(userId: string) {
  // IMPORTANT: transact is how you write data to the database
  // We want to block until the profile is created, so we use await
  await db.transact(
    db.tx.profiles[userId].update({
      handle: randomHandle(),
    }).link({ user: userId })
  );
}

function addPost(text: string, authorId: string | undefined) {
  db.transact(
    // IMPORTANT: ids must be a valid UUID, so we use `id()` to generate one
    db.tx.posts[id()].update({
      text,
      createdAt: Date.now(),
    }).link({ author: authorId })
  );
}

function deletePost(postId: string) {
  db.transact(db.tx.posts[postId].delete());
}

// Ephemeral helpers
// ---------
function makeShout(text: string) {
  const maxX = window.innerWidth - 200; // Leave some margin
  const maxY = window.innerHeight - 100;
  return {
    text,
    x: Math.random() * maxX,
    y: Math.random() * maxY,
    angle: (Math.random() - 0.5) * 30,
    size: Math.random() * 20 + 18,
  };
}

function addShout({ text, x, y, angle, size }: { text: string, x: number, y: number, angle: number, size: number }) {
  const shoutElement = document.createElement('div');
  shoutElement.textContent = text;
  shoutElement.style.cssText = `
    left: ${x}px;
    top: ${y}px;
    position: fixed;
    z-index: 9999;
    font-size: ${size}px;
    font-weight: bold;
    pointer-events: none;
    transition: opacity 2s ease-out;
    opacity: 1;
    font-family: system-ui, -apple-system, sans-serif;
    white-space: nowrap;
    transform: rotate(${angle}deg);
  `;
  document.body.appendChild(shoutElement);
  setTimeout(() => {
    shoutElement.style.opacity = '0';
  }, 100);
  setTimeout(() => {
    shoutElement.remove();
  }, 2100);
}

// Instant query Hooks
// ---------
function useProfile() {
  const { user } = db.useAuth();
  if (!user) {
    throw new Error("useProfile must be used after auth");

  }
  const { data, isLoading, error } = db.useQuery({
    profiles: {
      $: { where: { "user.id": user.id } },
      avatar: {},
    }
  });
  const profile = data?.profiles?.[0];

  return { profile, isLoading, error };
}

function useAuthAndProfile(): { user: User, profile: ProfileWithAvatar } {
  const { user } = db.useAuth();
  const { profile } = useProfile();
  if (!user || !profile) {
    throw new Error("useAuthAndProfile must be used after auth and profile are loaded");
  }
  return { user, profile }
}

function usePosts(pageNumber: number, pageSize: number) {
  const { isLoading, error, data } = db.useQuery({
    posts: {
      $: {
        order: { createdAt: "desc" },
        limit: pageSize,
        offset: (pageNumber - 1) * pageSize,
      },
      author: {
        avatar: {},
      },
    },
  });

  return { isLoading, error, posts: data?.posts || [] };
}

// Auth Components
// ---------
function AuthGate({ children }: { children: React.ReactNode }) {
  const { user, isLoading, error } = db.useAuth();

  if (isLoading) return null;
  if (error) return <div className="p-4 text-red-500">Auth error: {error.message}</div>;
  if (!user) return <Login />;

  return <>{children}</>;
}

function Login() {
  const [sentEmail, setSentEmail] = useState("");

  return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="max-w-sm">
        {!sentEmail ? (
          <EmailStep onSendEmail={setSentEmail} />
        ) : (
          <CodeStep sentEmail={sentEmail} />
        )}
      </div>
    </div>
  );
}

function EmailStep({ onSendEmail }: { onSendEmail: (email: string) => void }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inputEl = inputRef.current!;
    const email = inputEl.value;
    onSendEmail(email);
    db.auth.sendMagicCode({ email }).catch((err) => {
      alert("Uh oh :" + err.body?.message);
      onSendEmail("");
    });
  };
  return (
    <form
      key="email"
      onSubmit={handleSubmit}
      className="flex flex-col space-y-4"
    >
      <h2 className="text-xl font-bold">Instant Demo app</h2>
      <p className="text-gray-700">
        To try the app, enter your email, and we'll send you a verification code. We'll create
        an account for you too if you don't already have one.
      </p>
      <input ref={inputRef} type="email" className="border border-gray-300 px-3 py-1  w-full" placeholder="Enter your email" required autoFocus />
      <button type="submit" className="px-3 py-1 bg-blue-600 text-white font-bold hover:bg-blue-700 w-full" >
        Send Code
      </button>
    </form>
  );
}

function CodeStep({ sentEmail }: { sentEmail: string }) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const inputEl = inputRef.current!;
    const code = inputEl.value;
    db.auth.signInWithMagicCode({ email: sentEmail, code }).catch((err) => {
      inputEl.value = "";
      alert("Uh oh :" + err.body?.message);
    });
  };

  return (
    <form
      key="code"
      onSubmit={handleSubmit}
      className="flex flex-col space-y-4"
    >
      <h2 className="text-xl font-bold">Enter your code</h2>
      <p className="text-gray-700">
        We sent an email to <strong>{sentEmail}</strong>. Check your email, and
        paste the code you see.
      </p>
      <input ref={inputRef} type="text" className="border border-gray-300 px-3 py-1  w-full" placeholder="123456..." required autoFocus />
      <button type="submit" className="px-3 py-1 bg-blue-600 text-white font-bold hover:bg-blue-700 w-full" >
        Verify Code
      </button>
    </form>
  );
}

function EnsureProfile({ children }: { children: React.ReactNode }) {
  const { user } = db.useAuth();
  const { isLoading, profile, error } = useProfile();

  useEffect(() => {
    if (!isLoading && !profile) {
      createProfile(user!.id);
    }
  }, [user, isLoading, profile]);

  if (isLoading) return null;
  if (error) return <div className="p-4 text-red-500">Profile error: {error.message}</div>;
  if (!profile) return null; // Still creating profile...

  return <>{children}</>;
}

// Use the room for presence and topics
c