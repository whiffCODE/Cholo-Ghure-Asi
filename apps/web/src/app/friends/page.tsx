"use client";



import { FormEvent, useCallback, useEffect, useState } from "react";

import Link from "next/link";

import { useRouter } from "next/navigation";

import { ArrowLeft, Copy, Users, UserPlus, Search, LogOut, RefreshCw, Check, X, Plus, LogIn, ShieldCheck } from "lucide-react";

import { Navbar } from "@/components/navbar";



const API = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";



type Person = { id: string; fullName: string; email: string; phone?: string };

type SearchPerson = Person & { relationship: "friend" | "incoming" | "sent" | "none" };

type Group = { id: string; name: string; description?: string; inviteCode?: string; isOwner: boolean; memberCount: number; members?: { id: string; fullName: string; email: string }[]; owner?: { id: string; fullName: string } | null };

type RequestItem = { requestId: string; user: Person };



async function api(path: string, init: RequestInit = {}) {

  const response = await fetch(`${API}/api/social${path}`, {

    ...init,

    credentials: "include",

    headers: { ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}), ...init.headers },

  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) throw new Error(data.error ?? "Something went wrong. Please try again.");

  return data;

}



export default function FriendsPage() {

  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [busy, setBusy] = useState(false);

  const [error, setError] = useState("");

  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");

  const [results, setResults] = useState<SearchPerson[]>([]);

  const [friends, setFriends] = useState<Person[]>([]);

  const [incoming, setIncoming] = useState<RequestItem[]>([]);

  const [outgoing, setOutgoing] = useState<RequestItem[]>([]);

  const [groups, setGroups] = useState<Group[]>([]);

  const [groupName, setGroupName] = useState("");

  const [groupDescription, setGroupDescription] = useState("");

  const [inviteCode, setInviteCode] = useState("");



  const load = useCallback(async () => {

    setError("");

    try {

      const [f, r, g] = await Promise.all([api("/friends"), api("/friends/requests"), api("/groups")]);

      setFriends(f.friends ?? []);

      setIncoming(r.incoming ?? []);

      setOutgoing(r.outgoing ?? []);

      setGroups(g.groups ?? []);

    } catch (e) {

      const message = e instanceof Error ? e.message : "Could not load your friends and groups.";

      if (message.toLowerCase().includes("sign in")) router.replace("/login");

      else setError(message);

    } finally { setLoading(false); }

  }, [router]);



  useEffect(() => { void load(); }, [load]);



  async function runAction(action: () => Promise<void>) {

    setBusy(true); setError(""); setNotice("");

    try { await action(); } catch (e) { setError(e instanceof Error ? e.message : "Action failed."); }

    finally { setBusy(false); }

  }



  async function searchUsers(event: FormEvent) {

    event.preventDefault();

    await runAction(async () => {

      const data = await api(`/users/search?q=${encodeURIComponent(query.trim())}`);

      setResults(data.users ?? []);

      if (!data.users?.length) setNotice("No matching users found. Try the exact email or phone number.");

    });

  }



  async function sendRequest(user: SearchPerson) {

    await runAction(async () => {

      const data = await api("/friends/requests", { method: "POST", body: JSON.stringify({ userId: user.id }) });

      setNotice(data.message); setResults((items) => items.map((item) => item.id === user.id ? { ...item, relationship: "sent" } : item));

      await load();

    });

  }



  async function respond(request: RequestItem, action: "accept" | "decline") {

    await runAction(async () => {

      const data = await api(`/friends/requests/${request.requestId}/respond`, { method: "POST", body: JSON.stringify({ action }) });

      setNotice(data.message); await load();

    });

  }



  async function createGroup(event: FormEvent) {

    event.preventDefault();

    await runAction(async () => {

      const data = await api("/groups", { method: "POST", body: JSON.stringify({ name: groupName, description: groupDescription }) });

      setGroupName(""); setGroupDescription(""); setNotice(`Group “${data.group.name}” created. Share its invite code with your crew.`); await load();

    });

  }



  async function joinGroup(event: FormEvent) {

    event.preventDefault();

    await runAction(async () => {

      const data = await api("/groups/join", { method: "POST", body: JSON.stringify({ inviteCode }) });

      setInviteCode(""); setNotice(data.message); await load();

    });

  }



    async function unfriend(friendId: string) {
    const confirmed = window.confirm("Are you sure you want to unfriend this person?");
    if (!confirmed) return;
    await runAction(async () => {
      const data = await api(`/friends/${friendId}`, { method: "DELETE" });
      setNotice(data.message ?? "Friend removed successfully.");
      setResults((items) => items.map((item) => item.id === friendId ? { ...item, relationship: "none" } : item));
      await load();
    });
  }

  async function removeGroupMember(groupId: string, memberId: string) {
    const confirmed = window.confirm("Remove this member from the group?");
    if (!confirmed) return;
    await runAction(async () => {
      const data = await api(`/groups/${groupId}/members/${memberId}`, { method: "DELETE" });
      setNotice(data.message ?? "Member removed from the group.");
      await load();
    });
  }

  async function leaveGroup(group: Group) {

    if (!window.confirm(group.isOwner ? `Delete “${group.name}” for everyone?` : `Leave “${group.name}”?`)) return;

    await runAction(async () => { const data = await api(`/groups/${group.id}/leave`, { method: "POST" }); setNotice(data.message); await load(); });

  }



  async function regenerate(group: Group) {

    if (!window.confirm("Regenerate the invite code? The old code will stop working.")) return;

    await runAction(async () => { const data = await api(`/groups/${group.id}/regenerate-invite`, { method: "POST" }); setNotice(`New invite code: ${data.inviteCode}`); await load(); });

  }



  async function copyCode(code: string) {

    try { await navigator.clipboard.writeText(code); setNotice("Invite code copied."); }

    catch { setNotice(`Copy this invite code: ${code}`); }

  }



  return (

    <main className="min-h-screen bg-gradient-to-b from-rose-50 via-orange-50/70 to-amber-50 text-rose-950 dark:from-[#180b12] dark:via-[#21101a] dark:to-[#120b10] dark:text-rose-50">

      <Navbar />

      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">

        <Link href="/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-rose-800 hover:underline dark:text-amber-200"><ArrowLeft size={16}/> Back to profile</Link>

        <div className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-r from-[#5a1026] via-[#811d34] to-[#a53d32] p-6 text-white shadow-xl sm:p-9">

          <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">

            <div><p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-200">Puja is better together</p><h1 className="mt-2 text-3xl font-black sm:text-4xl">Your Puja crew 🪔</h1><p className="mt-3 max-w-xl text-sm text-rose-100 sm:text-base">Find your people, make a group, and swap an invite code. Your live location is not shared by this page.</p></div>

            <div className="flex gap-3 text-sm"><span className="rounded-full bg-white/10 px-4 py-2">{friends.length} friends</span><span className="rounded-full bg-white/10 px-4 py-2">{groups.length} groups</span></div>

          </div>

        </div>



        {(error || notice) && <div role="status" className={`mt-5 rounded-2xl border p-4 text-sm ${error ? "border-red-300 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-200" : "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"}`}>{error || notice}</div>}



        <div className="mt-6 grid gap-6 lg:grid-cols-2">

          <section className="rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">

            <div className="flex items-center gap-3"><div className="rounded-2xl bg-rose-100 p-3 text-rose-800 dark:bg-rose-900/50 dark:text-rose-200"><UserPlus/></div><div><h2 className="text-xl font-extrabold">Find friends</h2><p className="text-sm text-rose-700/70 dark:text-rose-100/60">Search using an exact email or phone number.</p></div></div>

            <form onSubmit={searchUsers} className="mt-5 flex gap-2"><label className="sr-only" htmlFor="friend-search">Email or phone</label><input id="friend-search" value={query} onChange={(e) => setQuery(e.target.value)} minLength={3} maxLength={254} placeholder="friend@email.com or +91…" className="min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500 focus:ring-2 focus:ring-rose-200 dark:border-white/15 dark:bg-black/20"/><button disabled={busy || query.trim().length < 3} className="inline-flex items-center gap-2 rounded-xl bg-rose-900 px-4 py-3 text-sm font-bold text-white disabled:opacity-50"><Search size={16}/><span className="hidden sm:inline">Search</span></button></form>

            {results.length > 0 && <div className="mt-4 divide-y divide-rose-100 dark:divide-white/10">{results.map((person) => <div key={person.id} className="flex items-center justify-between gap-3 py-3"><div className="min-w-0"><p className="truncate font-bold">{person.fullName}</p><p className="truncate text-sm text-rose-700/70 dark:text-rose-100/60">{person.email}</p></div>{person.relationship === "friend" ? <span className="text-xs font-bold text-emerald-700 dark:text-emerald-300">Friends ✓</span> : person.relationship === "sent" ? <span className="text-xs text-amber-700 dark:text-amber-200">Request sent</span> : person.relationship === "incoming" ? <span className="text-xs text-sky-700 dark:text-sky-200">They requested you</span> : <button disabled={busy} onClick={() => void sendRequest(person)} className="shrink-0 rounded-xl border border-rose-200 px-3 py-2 text-xs font-bold hover:bg-rose-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10">Add friend</button>}</div>)}</div>}

            <div className="mt-6 border-t border-rose-100 pt-5 dark:border-white/10"><h3 className="font-extrabold">Incoming requests <span className="text-sm font-normal text-rose-700/70 dark:text-rose-100/60">({incoming.length})</span></h3>{incoming.length === 0 ? <p className="mt-2 text-sm text-rose-700/70 dark:text-rose-100/60">No pending requests right now.</p> : <div className="mt-2 space-y-2">{incoming.map((item) => <div key={item.requestId} className="flex items-center justify-between gap-3 rounded-xl bg-rose-50 p-3 dark:bg-white/5"><div className="min-w-0"><p className="truncate text-sm font-bold">{item.user.fullName}</p><p className="truncate text-xs opacity-70">{item.user.email}</p></div><div className="flex gap-2"><button aria-label={`Accept ${item.user.fullName}`} disabled={busy} onClick={() => void respond(item, "accept")} className="rounded-lg bg-emerald-700 p-2 text-white"><Check size={16}/></button><button aria-label={`Decline ${item.user.fullName}`} disabled={busy} onClick={() => void respond(item, "decline")} className="rounded-lg border border-rose-200 p-2 dark:border-white/15"><X size={16}/></button></div></div>)}</div>}</div>

            {outgoing.length > 0 && <div className="mt-5 border-t border-rose-100 pt-5 dark:border-white/10"><h3 className="font-extrabold">Sent requests <span className="text-sm font-normal opacity-60">({outgoing.length})</span></h3><div className="mt-2 space-y-2">{outgoing.map((item) => <div key={item.requestId} className="rounded-xl bg-amber-50 p-3 dark:bg-amber-950/30"><p className="truncate text-sm font-bold">{item.user.fullName}</p><p className="truncate text-xs opacity-70">Waiting for {item.user.email} to respond</p></div>)}</div></div>}

            <div className="mt-5">
              <h3 className="font-extrabold">Your friends <span className="text-sm font-normal opacity-60">({friends.length})</span></h3>
              {friends.length === 0 ? (
                <p className="mt-2 text-sm opacity-65">Your crew starts with one friend request.</p>
              ) : (
                <div className="mt-2 space-y-2">
                  {friends.map((friend) => (
                    <div key={friend.id} className="flex items-center justify-between gap-3 rounded-xl border border-rose-100 px-3 py-3 dark:border-white/10">
                      <div className="min-w-0">
                        <p className="truncate font-bold">{friend.fullName}</p>
                        <p className="truncate text-sm opacity-65">{friend.email}</p>
                      </div>
                      <button type="button" disabled={busy} onClick={() => void unfriend(friend.id)} className="shrink-0 rounded-lg border border-red-200 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/40">Unfriend</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            </section>



          <section className="space-y-6">

            <div className="rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6">

              <div className="flex items-center gap-3"><div className="rounded-2xl bg-amber-100 p-3 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"><Users/></div><div><h2 className="text-xl font-extrabold">Create a Puja group</h2><p className="text-sm opacity-65">One group, one code, your whole crew.</p></div></div>

              <form onSubmit={createGroup} className="mt-5 space-y-3"><label className="block text-sm font-semibold" htmlFor="group-name">Group name</label><input id="group-name" value={groupName} onChange={(e) => setGroupName(e.target.value)} required minLength={2} maxLength={60} placeholder="North Kolkata Night Owls" className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500 dark:border-white/15 dark:bg-black/20"/><label className="block text-sm font-semibold" htmlFor="group-description">Description <span className="font-normal opacity-60">(optional)</span></label><input id="group-description" value={groupDescription} onChange={(e) => setGroupDescription(e.target.value)} maxLength={240} placeholder="Our route, food stops and meeting point" className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-sm outline-none focus:border-rose-500 dark:border-white/15 dark:bg-black/20"/><button disabled={busy || groupName.trim().length < 2} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-900 px-4 py-3 font-bold text-white disabled:opacity-50"><Plus size={17}/> Create group</button></form>

              <form onSubmit={joinGroup} className="mt-5 border-t border-rose-100 pt-5 dark:border-white/10"><label htmlFor="invite-code" className="block text-sm font-bold">Have an invite code?</label><div className="mt-2 flex gap-2"><input id="invite-code" value={inviteCode} onChange={(e) => setInviteCode(e.target.value.toUpperCase().replace(/[^A-F0-9]/g, "").slice(0, 10))} required minLength={10} maxLength={10} placeholder="10-character code" className="min-w-0 flex-1 rounded-xl border border-rose-200 bg-white px-4 py-3 font-mono uppercase tracking-widest outline-none focus:border-rose-500 dark:border-white/15 dark:bg-black/20"/><button disabled={busy || inviteCode.length !== 10} className="inline-flex items-center gap-2 rounded-xl border border-rose-300 px-4 py-3 text-sm font-bold hover:bg-rose-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10"><LogIn size={16}/> Join</button></div></form>

            </div>



            <div className="rounded-3xl border border-rose-100 bg-white/90 p-5 shadow-sm dark:border-white/10 dark:bg-white/5 sm:p-6"><div className="flex items-center justify-between gap-3"><div className="flex items-center gap-3"><div className="rounded-2xl bg-violet-100 p-3 text-violet-900 dark:bg-violet-900/40 dark:text-violet-200"><Users/></div><div><h2 className="text-xl font-extrabold">Your groups</h2><p className="text-sm opacity-65">Invite your friends and plan the route.</p></div></div><button onClick={() => void load()} aria-label="Refresh groups" className="rounded-xl border border-rose-200 p-2 hover:bg-rose-50 dark:border-white/15 dark:hover:bg-white/10"><RefreshCw size={16}/></button></div>

              {loading ? <p className="mt-5 text-sm opacity-65">Loading your crew…</p> : groups.length === 0 ? <div className="mt-5 rounded-2xl border border-dashed border-rose-200 p-5 text-center dark:border-white/15"><Users className="mx-auto opacity-50"/><p className="mt-2 font-bold">No groups yet</p><p className="mt-1 text-sm opacity-65">Create a group or join one with an invite code.</p></div> : <div className="mt-4 space-y-3">{groups.map((group) => <article key={group.id} className="rounded-2xl border border-rose-100 p-4 dark:border-white/10"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="font-extrabold">{group.name}</h3>{group.description && <p className="mt-1 text-sm opacity-65">{group.description}</p>}<p className="mt-2 text-xs opacity-60">{group.memberCount} member{group.memberCount === 1 ? "" : "s"} · {group.isOwner ? "You organise this group" : `Organised by ${group.owner?.fullName ?? "a member"}`}</p></div><button onClick={() => void leaveGroup(group)} disabled={busy} className="shrink-0 rounded-lg border border-rose-200 px-3 py-2 text-xs font-bold hover:bg-rose-50 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/10">{group.isOwner ? "Delete" : "Leave"}</button></div>

                {group.inviteCode && <div className="mt-4 rounded-xl bg-amber-50 p-3 dark:bg-amber-950/40"><p className="text-xs font-bold uppercase tracking-wider opacity-65">Your invite code</p><div className="mt-2 flex items-center justify-between gap-3"><code className="break-all text-lg font-black tracking-[0.18em]">{group.inviteCode}</code><button onClick={() => void copyCode(group.inviteCode!)} aria-label="Copy invite code" className="rounded-lg bg-amber-200 p-2 text-amber-950 hover:bg-amber-300 dark:bg-amber-900 dark:text-amber-100"><Copy size={16}/></button></div><button onClick={() => void regenerate(group)} disabled={busy} className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-rose-800 hover:underline disabled:opacity-50 dark:text-amber-200"><RefreshCw size={13}/> Regenerate code</button></div>}

                {group.members && <div className="mt-3"><p className="text-xs font-bold uppercase tracking-wider opacity-55">Members</p><div className="mt-2 flex flex-wrap gap-2">{group.members.map((member) => <div key={member.id} className="flex items-center gap-2 rounded-full bg-rose-50 py-1 pl-3 pr-1.5 text-xs font-semibold dark:bg-white/10"><span>{member.fullName}{member.id === group.owner?.id ? " · organiser" : ""}</span>{group.isOwner && member.id !== group.owner?.id && <button type="button" disabled={busy} onClick={() => void removeGroupMember(group.id, member.id)} className="rounded-full px-2 py-1 text-red-700 hover:bg-red-100 disabled:opacity-50 dark:text-red-300 dark:hover:bg-red-950/50" aria-label={`Remove ${member.fullName} from ${group.name}`}>Remove</button>}</div>)}</div></div>}

              </article>)}</div>}

            </div>

            <div className="flex items-start gap-3 rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sm text-sky-950 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-100"><ShieldCheck size={19} className="mt-0.5 shrink-0"/><p><strong>Privacy note:</strong> group membership does not share live location. Live location will be a separate, opt-in feature in a later phase.</p></div>

          </section>

        </div>

        <div className="mt-8 flex justify-center"><button onClick={() => void runAction(async () => { await fetch(`${API}/api/auth/logout`, { method: "POST", credentials: "include" }); router.replace("/login"); })} className="inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold text-rose-800 hover:bg-rose-100 dark:text-rose-100 dark:hover:bg-white/10"><LogOut size={16}/> Sign out</button></div>

      </div>

    </main>

  );

}
