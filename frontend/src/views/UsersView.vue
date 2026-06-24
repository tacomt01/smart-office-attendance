<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import api, { assetUrl } from '../services/api';
import {
  UsersIcon, PlusIcon, PencilSquareIcon, TrashIcon, KeyIcon,
  MagnifyingGlassIcon, CameraIcon, UserCircleIcon,
} from '@heroicons/vue/24/outline';
import { useI18n } from '../i18n';

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
  formErrors.value = {};
  showModal.value = true;
}

function openEdit(user: UserItem) {
  editingUser.value = user;
  form.value = { email: user.email, password: '', confirmPassword: '', fullName: user.fullName || '', role: user.role };
  showPasswordSection.value = false;
  modalAvatarUrl.value = user.avatar || null;
  saveResult.value = '';
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
  const file = (e.target as HTMLInputElement).files?.[0];
  if (!file) return;
  if (editingUser.value) {
    uploadingAvatar.value = true;
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const { data } = await api.post(`/users/${editingUser.value.id}/avatar`, fd);
      modalAvatarUrl.value = data.avatar;
      editingUser.value.avatar = data.avatar;
    } catch {} finally { uploadingAvatar.value = false; }
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

function inputClass(field: string) {
  return formErrors.value[field]
    ? 'w-full px-3 py-2 bg-dark-900 border border-red-500 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-red-400 focus:ring-2 focus:ring-red-400/30'
    : 'w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30';
}
</script>

<template>
  <div class="p-4 md:p-8 max-w-5xl mx-auto">
    <div class="flex items-center justify-between mb-7">
      <h1 class="font-display text-3xl font-semibold tracking-wide text-accent flex items-center gap-2">
        <UsersIcon class="w-7 h-7" /> {{ t('users_title') }}
      </h1>
      <button @click="openAdd" class="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-light text-dark-900 font-semibold rounded-lg transition-all duration-300 hover:-translate-y-0.5">
        <PlusIcon class="w-5 h-5" /> {{ t('users_add') }}
      </button>
    </div>

    <!-- Search Bar -->
    <div class="bg-dark-800 border border-dark-700 rounded-2xl p-5 shadow-sm mb-4 flex flex-col md:flex-row md:flex-wrap gap-3 md:items-end">
      <div class="w-full md:flex-1 md:min-w-[200px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('search') }}</label>
        <div class="relative">
          <MagnifyingGlassIcon class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input v-model="searchQuery" type="text" :placeholder="t('users_search')"
            class="w-full pl-9 pr-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
        </div>
      </div>
      <div class="w-full md:w-auto md:min-w-[140px]">
        <label class="block text-xs text-slate-400 mb-1">{{ t('users_role') }}</label>
        <select v-model="searchRole"
          class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent">
          <option value="">{{ t('all') }}</option>
          <option value="admin">admin</option>
          <option value="employee">employee</option>
        </select>
      </div>
    </div>

    <!-- Table -->
    <div class="bg-dark-800 border border-dark-700 rounded-2xl overflow-x-auto shadow-sm">
      <table class="w-full text-sm">
        <thead>
          <tr class="border-b border-dark-700 text-slate-400">
            <th class="text-left px-4 py-3 font-medium w-12"></th>
            <th class="text-left px-4 py-3 font-medium">{{ t('users_email') }}</th>
            <th class="text-left px-4 py-3 font-medium">{{ t('users_fullname') }}</th>
            <th class="text-left px-4 py-3 font-medium">{{ t('users_role') }}</th>
            <th class="hidden md:table-cell text-left px-4 py-3 font-medium">{{ t('users_created') }}</th>
            <th class="text-right px-4 py-3 font-medium">{{ t('users_actions') }}</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="user in filteredUsers" :key="user.id" class="border-b border-dark-700/50 hover:bg-dark-700/30 transition-colors duration-200">
            <td class="px-4 py-3">
              <div class="w-8 h-8 rounded-full overflow-hidden bg-dark-700">
                <img v-if="user.avatar" :src="avatarSrc(user.avatar)" class="w-full h-full object-cover" />
                <UserCircleIcon v-else class="w-full h-full text-slate-500" />
              </div>
            </td>
            <td class="px-4 py-3 text-slate-100">{{ user.email }}</td>
            <td class="px-4 py-3 text-slate-300">{{ user.fullName || '-' }}</td>
            <td class="px-4 py-3">
              <span :class="user.role === 'admin' ? 'bg-[#8a8fc4]/15 text-[#767bb5]' : 'bg-[#6f9e87]/15 text-[#5e8a74]'"
                class="px-2 py-0.5 rounded-full text-xs font-medium">{{ user.role }}</span>
            </td>
            <td class="hidden md:table-cell px-4 py-3 text-slate-400">{{ formatDate(user.createdAt) }}</td>
            <td class="px-4 py-3 text-right">
              <button @click="openEdit(user)" class="text-slate-400 hover:text-accent transition p-1"><PencilSquareIcon class="w-4 h-4" /></button>
              <button @click="openDelete(user)" class="text-slate-400 hover:text-red-400 transition p-1 ml-1"><TrashIcon class="w-4 h-4" /></button>
            </td>
          </tr>
          <tr v-if="filteredUsers.length === 0 && !loading">
            <td colspan="6" class="px-4 py-8 text-center text-slate-500">{{ t('users_no_data') }}</td>
          </tr>
        </tbody>
      </table>
    </div>

    <!-- Add/Edit Modal -->
    <div v-if="showModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center glass">
      <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto animate-scaleIn">
        <h3 class="font-display text-xl font-semibold text-slate-100 mb-4 tracking-wide">{{ editingUser ? t('users_edit_title') : t('users_add_title') }}</h3>

        <!-- Loading state -->
        <div v-if="saving" class="flex flex-col items-center py-8">
          <div class="w-12 h-12 border-4 border-accent/30 border-t-accent rounded-full animate-spin mb-4"></div>
          <p class="text-slate-300 text-sm">{{ t('saving') }}</p>
        </div>

        <!-- Result state (success or API error) -->
        <div v-else-if="saveResult" class="flex flex-col items-center py-8">
          <div v-if="saveResult === 'success'" class="w-14 h-14 bg-[#6f9e87]/20 rounded-full flex items-center justify-center mb-4 animate-bounceIn">
            <svg class="w-8 h-8 text-[#5e8a74]" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" /></svg>
          </div>
          <div v-else class="w-14 h-14 bg-red-500/20 rounded-full flex items-center justify-center mb-4 animate-bounceIn">
            <svg class="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" /></svg>
          </div>
          <p :class="saveResult === 'success' ? 'text-[#5e8a74]' : 'text-red-400'" class="text-lg font-semibold">{{ saveMessage }}</p>
          <button v-if="saveResult === 'error'" @click="showModal = false" class="mt-4 px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">{{ t('close') }}</button>
        </div>

        <!-- Form -->
        <div v-else class="space-y-4">
          <!-- Avatar -->
          <div class="flex flex-col items-center">
            <div class="relative group">
              <div class="w-20 h-20 rounded-full overflow-hidden border-2 border-dark-600 bg-dark-900">
                <img v-if="editingUser && modalAvatarUrl" :src="avatarSrc(modalAvatarUrl)" class="w-full h-full object-cover" />
                <img v-else-if="!editingUser && modalAvatarPreview" :src="modalAvatarPreview" class="w-full h-full object-cover" />
                <UserCircleIcon v-else class="w-full h-full text-slate-500" />
              </div>
              <label class="absolute inset-0 rounded-full bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center cursor-pointer transition">
                <CameraIcon class="w-6 h-6 text-white" />
                <input type="file" accept="image/*" class="hidden" @change="uploadAvatar" />
              </label>
              <div v-if="uploadingAvatar" class="absolute inset-0 rounded-full bg-black/60 flex items-center justify-center">
                <div class="w-6 h-6 border-2 border-accent/30 border-t-accent rounded-full animate-spin"></div>
              </div>
            </div>
            <p class="text-xs text-slate-500 mt-1">{{ t('users_avatar_hint') }}</p>
          </div>

          <!-- Email -->
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('users_email') }} <span class="text-red-400">*</span></label>
            <input v-model="form.email" type="email" :class="inputClass('email')" @input="formErrors.email = ''" />
            <p v-if="formErrors.email" class="text-red-400 text-xs mt-1">{{ formErrors.email }}</p>
          </div>

          <!-- Password (new user) -->
          <template v-if="!editingUser">
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('users_password') }} <span class="text-red-400">*</span></label>
              <input v-model="form.password" type="password" :placeholder="t('users_password_min')" :class="inputClass('password')" @input="formErrors.password = ''" />
              <p v-if="formErrors.password" class="text-red-400 text-xs mt-1">{{ formErrors.password }}</p>
            </div>
            <div>
              <label class="block text-xs text-slate-400 mb-1">{{ t('users_confirm_password') }} <span class="text-red-400">*</span></label>
              <input v-model="form.confirmPassword" type="password" :class="inputClass('confirmPassword')" @input="formErrors.confirmPassword = ''" />
              <p v-if="formErrors.confirmPassword" class="text-red-400 text-xs mt-1">{{ formErrors.confirmPassword }}</p>
            </div>
          </template>

          <!-- Password (edit user) -->
          <template v-if="editingUser">
            <div class="border-t border-dark-700 pt-3">
              <button @click="togglePassword" type="button" class="flex items-center gap-2 text-sm transition"
                :class="showPasswordSection ? 'text-[#b8862f]' : 'text-slate-400 hover:text-accent'">
                <KeyIcon class="w-4 h-4" /> {{ showPasswordSection ? t('users_cancel_password') : t('users_change_password') }}
              </button>
              <div v-if="showPasswordSection" class="mt-3 space-y-3">
                <div>
                  <label class="block text-xs text-slate-400 mb-1">{{ t('profile_new_password') }}</label>
                  <input v-model="form.password" type="password" :placeholder="t('users_password_min')" :class="inputClass('password')" @input="formErrors.password = ''" />
                  <p v-if="formErrors.password" class="text-red-400 text-xs mt-1">{{ formErrors.password }}</p>
                </div>
                <div>
                  <label class="block text-xs text-slate-400 mb-1">{{ t('profile_confirm_password') }}</label>
                  <input v-model="form.confirmPassword" type="password" :class="inputClass('confirmPassword')" @input="formErrors.confirmPassword = ''" />
                  <p v-if="formErrors.confirmPassword" class="text-red-400 text-xs mt-1">{{ formErrors.confirmPassword }}</p>
                </div>
              </div>
            </div>
          </template>

          <!-- Name & Role -->
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('users_fullname') }}</label>
            <input v-model="form.fullName" type="text" class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30" />
          </div>
          <div>
            <label class="block text-xs text-slate-400 mb-1">{{ t('users_role') }}</label>
            <select v-model="form.role" class="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-slate-100 text-sm focus:outline-none focus:border-accent">
              <option value="employee">employee</option>
              <option value="admin">admin</option>
            </select>
          </div>
        </div>

        <!-- Buttons -->
        <div v-if="!saving && !saveResult" class="flex gap-3 justify-end mt-6">
          <button @click="showModal = false" class="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">{{ t('cancel') }}</button>
          <button @click="saveUser" :disabled="saving" class="px-4 py-2 bg-accent hover:bg-accent-light text-dark-900 font-semibold rounded-lg text-sm transition disabled:opacity-50">{{ t('save') }}</button>
        </div>
      </div>
    </div>

    <!-- Delete Modal -->
    <div v-if="showDeleteModal" class="fixed inset-0 bg-black/60 z-50 flex items-center justify-center glass">
      <div class="bg-dark-800 border border-dark-700 rounded-2xl p-6 w-full max-w-sm shadow-2xl animate-scaleIn">
        <template v-if="saving">
          <div class="flex flex-col items-center py-6">
            <div class="w-12 h-12 border-4 border-red-400/30 border-t-red-400 rounded-full animate-spin mb-4"></div>
            <p class="text-slate-300 text-sm">{{ t('users_deleting') }}</p>
          </div>
        </template>
        <template v-else>
          <h3 class="font-display text-xl font-semibold text-slate-100 mb-2 tracking-wide">{{ t('users_delete_title') }}</h3>
          <p class="text-slate-400 text-sm mb-6">{{ t('users_delete_msg') }} <span class="text-slate-200">{{ deletingUser?.email }}</span> ?</p>
          <div class="flex gap-3 justify-end">
            <button @click="showDeleteModal = false" class="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-slate-300 rounded-lg text-sm transition">{{ t('cancel') }}</button>
            <button @click="deleteUser" :disabled="saving" class="px-4 py-2 bg-red-600 hover:bg-red-500 text-white rounded-lg text-sm transition disabled:opacity-50">{{ t('delete') }}</button>
          </div>
        </template>
      </div>
    </div>
  </div>
</template>
