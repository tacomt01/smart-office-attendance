<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api, { assetUrl } from '../services/api';
import {
  UsersIcon, PlusIcon, PencilSquareIcon, TrashIcon, KeyIcon,
  MagnifyingGlassIcon, CameraIcon, UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { useI18n } from '../i18n';
import { validateAvatarFile, AVATAR_ACCEPT } from '../utils/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const { t } = useI18n();

interface UserItem {
  id: string;
  email: string;
  fullName?: string;
  role: string;
  avatar?: string;
  createdAt: string;
}

const users = ref<UserItem[]>([]);
const loading = ref(false);
const showModal = ref(false);
const showDeleteModal = ref(false);
const editingUser = ref<UserItem | null>(null);
const deletingUser = ref<UserItem | null>(null);
const saving = ref(false);
const saveResult = ref<'success' | 'error' | ''>('');
const saveMessage = ref('');
const showPasswordSection = ref(false);
const searchQuery = ref('');
const searchRole = ref('');
const modalAvatarUrl = ref<string | null>(null);
const modalAvatarPreview = ref<string | null>(null);
const pendingAvatarFile = ref<File | null>(null);
const uploadingAvatar = ref(false);
const avatarError = ref('');
const formErrors = ref<Record<string, string>>({});

const form = ref({ email: '', password: '', confirmPassword: '', fullName: '', role: 'employee' });

const filteredUsers = computed(() => {
  let list = users.value;
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(u => u.email.toLowerCase().includes(q) || (u.fullName || '').toLowerCase().includes(q));
  }
  if (searchRole.value) list = list.filter(u => u.role === searchRole.value);
  return list;
});

onMounted(() => fetchUsers());

async function fetchUsers() {
  loading.value = true;
  try { const { data } = await api.get('/users'); users.value = data; } catch {} finally { loading.value = false; }
}

function openAdd() {
  editingUser.value = null;
  form.value = { email: '', password: '', confirmPassword: '', fullName: '', role: 'employee' };
  showPasswordSection.value = true;
  if (modalAvatarPreview.value) URL.revokeObjectURL(modalAvatarPreview.value);
  modalAvatarUrl.value = null;
  modalAvatarPreview.value = null;
  pendingAvatarFile.value = null;
  saveResult.value = '';
  avatarError.value = '';
  formErrors.value = {};
  showModal.value = true;
}

function openEdit(user: UserItem) {
  editingUser.value = user;
  form.value = { email: user.email, password: '', confirmPassword: '', fullName: user.fullName || '', role: user.role };
  showPasswordSection.value = false;
  modalAvatarUrl.value = user.avatar || null;
  saveResult.value = '';
  avatarError.value = '';
  formErrors.value = {};
  showModal.value = true;
}

function openDelete(user: UserItem) { deletingUser.value = user; showDeleteModal.value = true; }

function togglePassword() {
  showPasswordSection.value = !showPasswordSection.value;
  if (!showPasswordSection.value) { form.value.password = ''; form.value.confirmPassword = ''; }
  formErrors.value = {};
}

async function uploadAvatar(e: Event) {
  const input = e.target as HTMLInputElement;
  const file = input.files?.[0];
  if (!file) return;
  avatarError.value = '';
  const errKey = validateAvatarFile(file);
  if (errKey) {
    avatarError.value = t(errKey);
    input.value = '';
    return;
  }
  if (editingUser.value) {
    uploadingAvatar.value = true;
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.post(`/users/${editingUser.value.id}/avatar`, fd);
      modalAvatarUrl.value = data.avatar;
      editingUser.value.avatar = data.avatar;
    } catch (err: any) {
      avatarError.value = err.response?.data?.error || t('users_avatar_failed');
    } finally { uploadingAvatar.value = false; }
  } else {
    pendingAvatarFile.value = file;
    if (modalAvatarPreview.value) URL.revokeObjectURL(modalAvatarPreview.value);
    modalAvatarPreview.value = URL.createObjectURL(file);
  }
}

function validateForm(): boolean {
  const errors: Record<string, string> = {};

  if (!form.value.email.trim()) {
    errors.email = t('users_email_required');
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.value.email)) {
    errors.email = t('email_invalid');
  }

  if (!editingUser.value) {
    if (!form.value.password) {
      errors.password = t('users_password_required');
    } else if (form.value.password.length < 6) {
      errors.password = t('users_password_min');
    }
    if (form.value.password && form.value.password !== form.value.confirmPassword) {
      errors.confirmPassword = t('users_password_mismatch');
    }
  }

  if (editingUser.value && showPasswordSection.value && form.value.password) {
    if (form.value.password.length < 6) {
      errors.password = t('users_password_min');
    }
    if (form.value.password !== form.value.confirmPassword) {
      errors.confirmPassword = t('users_password_mismatch');
    }
  }

  formErrors.value = errors;
  return Object.keys(errors).length === 0;
}

async function saveUser() {
  if (!validateForm()) return;

  saveResult.value = '';
  saving.value = true;
  const minDelay = new Promise(r => setTimeout(r, 2000));
  try {
    if (editingUser.value) {
      const payload: any = { email: form.value.email, fullName: form.value.fullName, role: form.value.role };
      if (showPasswordSection.value && form.value.password) payload.password = form.value.password;
      await api.put(`/users/${editingUser.value.id}`, payload);
    } else {
      const { data: newUser } = await api.post('/users', { email: form.value.email, password: form.value.password, fullName: form.value.fullName, role: form.value.role });
      if (pendingAvatarFile.value && newUser.id) {
        const fd = new FormData();
        fd.append('avatar', pendingAvatarFile.value);
        await api.post(`/users/${newUser.id}/avatar`, fd);
        pendingAvatarFile.value = null;
      }
    }
    await minDelay;
    saveResult.value = 'success';
    saveMessage.value = editingUser.value ? t('users_edit_success') : t('users_save_success');
    await fetchUsers();
    setTimeout(() => { showModal.value = false; }, 1500);
  } catch (e: any) {
    await minDelay;
    saveResult.value = 'error';
    saveMessage.value = e.response?.data?.error || t('users_save_error');
    setTimeout(() => { showModal.value = false; }, 3000);
  } finally { saving.value = false; }
}

async function deleteUser() {
  if (!deletingUser.value) return;
  saving.value = true;
  const minDelay = new Promise(r => setTimeout(r, 2000));
  try {
    await api.delete(`/users/${deletingUser.value.id}`);
    await minDelay;
    showDeleteModal.value = false;
    deletingUser.value = null;
    await fetchUsers();
  } catch { await minDelay; } finally { saving.value = false; }
}

function formatDate(d: string) { return new Date(d).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric' }); }
function avatarSrc(path?: string) { return assetUrl(path); }

// คืน class error (ต่อท้าย Input) เมื่อ field ผิด
function errCls(field: string) {
  return formErrors.value[field] ? 'border-destructive focus-visible:ring-destructive/30' : '';
}
const selectCls =
  'h-9 w-full rounded-md border border-input bg-background px-3 text-sm text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring';
</script>

<template>
  <div class="p-4 md:p-8 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-7">
      <h1 class="font-display text-3xl font-semibold tracking-wide text-primary flex items-center gap-2">
        <UsersIcon class="w-7 h-7" /> {{ t('users_title') }}
      </h1>
      <Button class="gap-2" @click="openAdd">
        <PlusIcon class="w-5 h-5" /> {{ t('users_add') }}
      </Button>
    </div>

    <!-- Search Bar -->
    <div class="bg-card border border-border rounded-2xl p-5 shadow-sm mb-4 flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
      <div class="w-full md:flex-1 md:min-w-[200px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('search') }}</Label>
        <div class="relative">
          <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground z-10" />
          <Input v-model="searchQuery" type="text" :placeholder="t('users_search')" class="pl-9" />
        </div>
      </div>
      <div class="w-full md:w-auto md:min-w-[140px] space-y-1.5">
        <Label class="text-xs text-muted-foreground">{{ t('users_role') }}</Label>
        <select v-model="searchRole" :class="selectCls">
          <option value="">{{ t('all') }}</option>
          <option value="admin">admin</option>
          <option value="employee">employee</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-card border border-border rounded-2xl overflow-x-auto shadow-sm">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead class="w-12"></TableHead>
            <TableHead>{{ t('users_email') }}</TableHead>
            <TableHead>{{ t('users_fullname') }}</TableHead>
            <TableHead>{{ t('users_role') }}</TableHead>
            <TableHead class="hidden md:table-cell">{{ t('users_created') }}</TableHead>
            <TableHead class="text-right">{{ t('users_actions') }}</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow v-for="user in filteredUsers" :key="user.id">
            <TableCell>
              <div class="w-8 h-8 rounded-full overflow-hidden bg-secondary">
                <img v-if="user.avatar" :src="avatarSrc(user.avatar)" class="w-full h-full object-cover" />
                <UserCircleIcon v-else class="w-full h-full text-muted-foreground" />
              </div>
            </TableCell>
            <TableCell class="text-foreground font-medium">{{ user.email }}</TableCell>
            <TableCell class="text-muted-foreground">{{ user.fullName || '-' }}</TableCell>
            <TableCell>
              <Badge :variant="user.role === 'admin' ? 'default' : 'secondary'">{{ user.role }}</Badge>
            </TableCell>
            <TableCell class="hidden md:table-cell text-muted-foreground">{{ formatDate(user.createdAt) }}</TableCell>
            <TableCell class="text-right">
              <Button variant="ghost" size="icon-sm" @click="openEdit(user)"><PencilSquareIcon class="w-4 h-4" /></Button>
              <Button variant="ghost" size="icon-sm" class="ml-1 text-muted-foreground hover:text-destructive" @click="openDelete(user)"><TrashIcon class="w-4 h-4" /></Button>
            </TableCell>
          </TableRow>
          <TableRow v-if="filteredUsers.length === 0 && !loading">
            <TableCell colspan="6" class="text-center text-muted-foreground py-8">{{ t('users_no_data') }}</TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </div>

    <!-- Add/Edit Dialog -->
    <Dialog v-model:open="showModal">
      <DialogContent class="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle class="font-display text-xl">{{ editingUser ? t('users_edit_title') : t('users_add_title') }}</DialogTitle>
        </DialogHeader>

        <!-- Loading state -->
        <div v-if="saving" class="flex flex-col items-center py-8">
          <div class="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
          <p class="text-muted-foreground text-sm">{{ t('saving') }}</p>
        </div>

        <!-- Result state (success or API error) -->
        <div v-else-if="saveResult" class="flex flex-col items-center py-8">
          <div v-if="saveResult === 'success'" class="w-14 h-14 bg-[#6f9e87]/20 rounded-full flex items-center justify-center mb-4 animate-bounceIn">
            <svg class="w-8 h-8 text-[#5e8a74]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div v-else class="w-14 h-14 bg-destructive/20 rounded-full flex items-center justify-center mb-4 animate-bounceIn">
            <svg class="w-8 h-8 text-destructive" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <p :class="saveResult === 'success' ? 'text-[#5e8a74]' : 'text-destructive'" class="text-lg font-semibold">{{ saveMessage }}</p>
          <Button v-if="saveResult === 'error'" variant="secondary" class="mt-4" @click="showModal = false">{{ t('close') }}</Button>
        </div>

        <!-- Form -->
        <div v-else class="space-y-4">
          <!-- Avatar -->
          <div class="flex flex-col items-center">
            <div class="relative group">
              <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-input bg-background">
                <img v-if="editingUser && modalAvatarUrl" :src="avatarSrc(modalAvatarUrl)" class="w-full h-full object-cover" />
                <img v-else-if="!editingUser && modalAvatarPreview" :src="modalAvatarPreview" class="w-full h-full object-cover" />
                <UserCircleIcon v-else class="w-full h-full text-muted-foreground" />
              </div>
              <label class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                <CameraIcon class="w-6 h-6 text-white" />
                <input type="file" :accept="AVATAR_ACCEPT" class="hidden" @change="uploadAvatar" />
              </label>
              <div v-if="uploadingAvatar" class="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
              </div>
            </div>
            <p class="text-xs text-muted-foreground mt-1">{{ t('users_avatar_hint') }}</p>
            <p v-if="avatarError" class="text-xs text-destructive mt-1">{{ avatarError }}</p>
          </div>

          <!-- Email -->
          <div class="space-y-1.5">
            <Label>{{ t('users_email') }} <span class="text-destructive">*</span></Label>
            <Input v-model="form.email" type="email" :class="errCls('email')" @input="formErrors.email = ''" />
            <p v-if="formErrors.email" class="text-destructive text-xs">{{ formErrors.email }}</p>
          </div>

          <!-- Password (new user) -->
          <template v-if="!editingUser">
            <div class="space-y-1.5">
              <Label>{{ t('users_password') }} <span class="text-destructive">*</span></Label>
              <Input v-model="form.password" type="password" :placeholder="t('users_password_min')" :class="errCls('password')" @input="formErrors.password = ''" />
              <p v-if="formErrors.password" class="text-destructive text-xs">{{ formErrors.password }}</p>
            </div>
            <div class="space-y-1.5">
              <Label>{{ t('users_confirm_password') }} <span class="text-destructive">*</span></Label>
              <Input v-model="form.confirmPassword" type="password" :class="errCls('confirmPassword')" @input="formErrors.confirmPassword = ''" />
              <p v-if="formErrors.confirmPassword" class="text-destructive text-xs">{{ formErrors.confirmPassword }}</p>
            </div>
          </template>

          <!-- Password (edit user) -->
          <template v-if="editingUser">
            <div class="border-t border-border pt-3">
              <Button variant="ghost" size="sm" type="button" class="gap-2 px-0 hover:bg-transparent"
                :class="showPasswordSection ? 'text-[#b8862f]' : 'text-muted-foreground hover:text-primary'" @click="togglePassword">
                <KeyIcon class="w-4 h-4" /> {{ showPasswordSection ? t('users_cancel_password') : t('users_change_password') }}
              </Button>
              <div v-if="showPasswordSection" class="mt-3 space-y-3">
                <div class="space-y-1.5">
                  <Label>{{ t('profile_new_password') }}</Label>
                  <Input v-model="form.password" type="password" :placeholder="t('users_password_min')" :class="errCls('password')" @input="formErrors.password = ''" />
                  <p v-if="formErrors.password" class="text-destructive text-xs">{{ formErrors.password }}</p>
                </div>
                <div class="space-y-1.5">
                  <Label>{{ t('profile_confirm_password') }}</Label>
                  <Input v-model="form.confirmPassword" type="password" :class="errCls('confirmPassword')" @input="formErrors.confirmPassword = ''" />
                  <p v-if="formErrors.confirmPassword" class="text-destructive text-xs">{{ formErrors.confirmPassword }}</p>
                </div>
              </div>
            </div>
          </template>

          <!-- Name & Role -->
          <div class="space-y-1.5">
            <Label>{{ t('users_fullname') }}</Label>
            <Input v-model="form.fullName" type="text" />
          </div>
          <div class="space-y-1.5">
            <Label>{{ t('users_role') }}</Label>
            <select v-model="form.role" :class="selectCls">
              <option value="employee">employee</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>

        <!-- Buttons -->
        <DialogFooter v-if="!saving && !saveResult">
          <Button variant="outline" @click="showModal = false">{{ t('cancel') }}</Button>
          <Button :disabled="saving" @click="saveUser">{{ t('save') }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Delete Dialog -->
    <Dialog v-model:open="showDeleteModal">
      <DialogContent class="max-w-sm">
        <template v-if="saving">
          <div class="flex flex-col items-center py-6">
            <div class="w-12 h-12 border-4 border-destructive/30 border-t-destructive rounded-full animate-spin mb-4"></div>
            <p class="text-muted-foreground text-sm">{{ t('users_deleting') }}</p>
          </div>
        </template>
        <template v-else>
          <DialogHeader>
            <DialogTitle class="font-display text-xl">{{ t('users_delete_title') }}</DialogTitle>
          </DialogHeader>
          <p class="text-muted-foreground text-sm">{{ t('users_delete_msg') }} <span class="text-foreground">{{ deletingUser?.email }}</span> ?</p>
          <DialogFooter>
            <Button variant="outline" @click="showDeleteModal = false">{{ t('cancel') }}</Button>
            <Button variant="destructive" :disabled="saving" @click="deleteUser">{{ t('delete') }}</Button>
          </DialogFooter>
        </template>
      </DialogContent>
    </Dialog>
  </div>
</template>
