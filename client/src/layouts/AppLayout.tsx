import { useState } from 'react';
import {
  Outlet,
  Link,
  useParams,
  useNavigate,
  useLocation,
} from 'react-router-dom';
import { useAuth } from '@/features/auth/use-auth';
import { useWorkspaces, useWorkspace } from '@/features/workspaces/use-workspaces';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  LayoutDashboard,
  Users,
  Settings,
  Plus,
  LogOut,
  Menu,
  ChevronDown,
  Building2,
  FolderKanban,
} from 'lucide-react';

export default function AppLayout() {
  const { workspaceId } = useParams<{ workspaceId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout, isLoggingOut } = useAuth();
  const { workspaces, createWorkspace, isCreating } = useWorkspaces();
  const { workspace } = useWorkspace(workspaceId);

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [createWsOpen, setCreateWsOpen] = useState(false);
  const [newWsName, setNewWsName] = useState('');
  const [wsSwitchOpen, setWsSwitchOpen] = useState(false);
  const [createWsError, setCreateWsError] = useState<string | null>(null);

  const isWorkspacesHome = location.pathname === '/workspaces';

  const activeWorkspace = isWorkspacesHome
    ? null
    : workspace || workspaces.find((w) => w.id === workspaceId) || null;

  const handleCreateWorkspace = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWsName.trim()) return;

    try {
      setCreateWsError(null);
      const created = await createWorkspace({ name: newWsName.trim() });
      setNewWsName('');
      setCreateWsOpen(false);
      navigate(`/workspaces/${created.id}/projects`);
    } catch (err) {
      setCreateWsError(err instanceof Error ? err.message : 'Failed to create workspace');
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const navItems = activeWorkspace
    ? [
        {
          name: 'Projects',
          path: `/workspaces/${activeWorkspace.id}/projects`,
          icon: FolderKanban,
        },
        {
          name: 'Members',
          path: `/workspaces/${activeWorkspace.id}/members`,
          icon: Users,
        },
        ...(activeWorkspace.role === 'OWNER' || activeWorkspace.role === 'ADMIN'
          ? [
              {
                name: 'Settings',
                path: `/workspaces/${activeWorkspace.id}/settings`,
                icon: Settings,
              },
            ]
          : []),
      ]
    : [
        {
          name: 'All Workspaces',
          path: '/workspaces',
          icon: Building2,
        },
      ];

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      {/* Mobile Backdrop */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border flex flex-col transition-transform duration-200 ease-in-out md:translate-x-0 ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* App Brand */}
        <div className="h-14 px-4 flex items-center justify-between border-b border-border">
          <Link
            to="/workspaces"
            className="flex items-center gap-2 font-bold text-base tracking-tight"
          >
            <div className="size-7 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <LayoutDashboard className="size-4" />
            </div>
            <span>TeamHub SaaS</span>
          </Link>
        </div>

        {/* Workspace Switcher */}
        <div className="p-3 border-b border-border">
          <div className="relative">
            <button
              onClick={() => setWsSwitchOpen(!wsSwitchOpen)}
              className="w-full flex items-center justify-between p-2 rounded-lg border border-border bg-muted/40 hover:bg-muted/70 transition-colors text-left cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="size-7 rounded-md bg-secondary flex items-center justify-center shrink-0">
                  <Building2 className="size-4 text-secondary-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold truncate">
                    {activeWorkspace?.name || 'Select Workspace'}
                  </p>
                  {activeWorkspace?.role && (
                    <Badge variant="outline" className="text-[10px] px-1 py-0 h-4">
                      {activeWorkspace.role}
                    </Badge>
                  )}
                </div>
              </div>
              <ChevronDown className="size-4 text-muted-foreground shrink-0 ml-1" />
            </button>

            {/* Dropdown Menu */}
            {wsSwitchOpen && (
              <div className="absolute top-full left-0 w-full mt-1.5 bg-popover border border-border rounded-lg shadow-lg z-50 p-1 space-y-1">
                <div className="px-2 py-1 text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
                  Workspaces
                </div>
                <div className="max-h-48 overflow-y-auto space-y-0.5">
                  {workspaces.map((ws) => (
                    <button
                      key={ws.id}
                      onClick={() => {
                        setWsSwitchOpen(false);
                        navigate(`/workspaces/${ws.id}/projects`);
                      }}
                      className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors text-left cursor-pointer ${
                        ws.id === activeWorkspace?.id
                          ? 'bg-primary text-primary-foreground font-medium'
                          : 'hover:bg-muted text-foreground'
                      }`}
                    >
                      <span className="truncate">{ws.name}</span>
                      {ws.role && (
                        <span className="text-[10px] opacity-80 uppercase">
                          {ws.role}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
                <div className="pt-1 border-t border-border">
                  <button
                    onClick={() => {
                      setWsSwitchOpen(false);
                      setCreateWsOpen(true);
                    }}
                    className="w-full flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-primary hover:bg-muted rounded-md transition-colors cursor-pointer font-medium"
                  >
                    <Plus className="size-3.5" />
                    <span>Create Workspace</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {navItems.map((item) => {
            const isActive = location.pathname.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link
                key={item.name}
                to={item.path}
                onClick={() => setMobileMenuOpen(false)}
                className={`flex items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:bg-muted hover:text-foreground'
                }`}
              >
                <Icon className="size-4" />
                <span>{item.name}</span>
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-3 border-t border-border bg-muted/20">
          <div className="flex items-center justify-between p-2 rounded-lg bg-card border border-border">
            <div className="min-w-0 pr-2">
              <p className="text-xs font-semibold truncate">{user?.name}</p>
              <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button
              onClick={handleLogout}
              disabled={isLoggingOut}
              title="Sign out"
              className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col md:pl-64 min-w-0">
        {/* Top Header */}
        <header className="h-14 border-b border-border bg-card px-4 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="p-1.5 rounded-md border border-border md:hidden text-foreground hover:bg-muted"
            >
              <Menu className="size-4" />
            </button>
            <div className="flex items-center gap-2 text-sm">
              <span className="font-semibold text-foreground">
                {activeWorkspace?.name || 'Workspaces'}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {activeWorkspace?.role && (
              <Badge variant="secondary" className="text-xs">
                {activeWorkspace.role}
              </Badge>
            )}
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto">
          <Outlet />
        </main>
      </div>

      {/* Create Workspace Dialog */}
      <Dialog open={createWsOpen} onOpenChange={setCreateWsOpen}>
        <DialogHeader>
          <DialogTitle>Create New Workspace</DialogTitle>
          <DialogDescription>
            Workspaces organize projects, tasks, and team members.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleCreateWorkspace}>
          <div className="space-y-4 py-2">
            {createWsError && (
              <div className="p-2.5 text-xs rounded-md bg-destructive/15 text-destructive border border-destructive/20">
                {createWsError}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="wsName">Workspace Name</Label>
              <Input
                id="wsName"
                placeholder="e.g. Acme Studio"
                value={newWsName}
                onChange={(e) => setNewWsName(e.target.value)}
                disabled={isCreating}
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setCreateWsOpen(false)}
              disabled={isCreating}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isCreating || !newWsName.trim()}>
              {isCreating ? 'Creating...' : 'Create Workspace'}
            </Button>
          </DialogFooter>
        </form>
      </Dialog>
    </div>
  );
}
