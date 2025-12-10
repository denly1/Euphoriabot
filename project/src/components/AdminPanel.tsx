import { useState, useEffect } from 'react';
import { Story, checkAdmin, getStories, updateStory, deleteStory } from '../lib/api';
import { X, Plus, Edit2, Trash2, Save, Image as ImageIcon, Type } from 'lucide-react';

interface AdminPanelProps {
  userId: number;
  onClose: () => void;
}

export default function AdminPanel({ userId, onClose }: AdminPanelProps) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<number>(1);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState('');
  const [caption, setCaption] = useState('');
  const [uploading, setUploading] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingStory, setEditingStory] = useState<Story | null>(null);

  useEffect(() => {
    checkAdminStatus();
    loadStories();
  }, [userId]);

  async function checkAdminStatus() {
    const admin = await checkAdmin(userId);
    setIsAdmin(admin);
    setLoading(false);
  }

  async function loadStories() {
    const data = await getStories();
    setStories(data);
  }

  function handleFileSelect(event: any) {
    const file = event.target.files?.[0];
    if (file) {
      setSelectedFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }

  async function uploadPhoto(): Promise<string | null> {
    if (!selectedFile) return null;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('user_id', userId.toString());

      const apiUrl = import.meta.env?.VITE_API_URL || 'https://euphoria.publicvm.com/api';
      const response = await fetch(`${apiUrl}/upload-story-photo`, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Upload failed');
      }

      const data = await response.json();
      return data.photo_url;
    } catch (error) {
      console.error('Upload error:', error);
      return null;
    } finally {
      setUploading(false);
    }
  }

  async function handleCreateStory() {
    let photoUrl = '';

    // Если выбран файл - загружаем его
    if (selectedFile) {
      const uploaded = await uploadPhoto();
      if (!uploaded) {
        alert('❌ Ошибка загрузки фото');
        return;
      }
      photoUrl = uploaded;
    }

    if (!photoUrl && !caption.trim()) {
      alert('Добавьте фото или текст');
      return;
    }

    // Создаем Story в выбранном слоте
    try {
      const formData = new FormData();
      formData.append('user_id', userId.toString());
      formData.append('slot_number', selectedSlot.toString());
      formData.append('file_id', photoUrl);
      if (caption) {
        formData.append('caption', caption);
      }

      const apiUrl = import.meta.env?.VITE_API_URL || 'https://euphoria.publicvm.com/api';
      const response = await fetch(`${apiUrl}/stories/create-in-slot`, {
        method: 'POST',
        body: formData,
      });

      if (response.ok) {
        await loadStories();
        setCaption('');
        setSelectedFile(null);
        setPreviewUrl('');
        setShowCreateForm(false);
        alert('✅ Story создана!');
      } else {
        alert('❌ Ошибка создания Story');
      }
    } catch (error) {
      console.error('Create story error:', error);
      alert('❌ Ошибка создания Story');
    }
  }

  async function handleUpdateStory(storyId: number, caption: string) {
    const result = await updateStory(userId, storyId, { caption });
    if (result) {
      await loadStories();
      setEditingStory(null);
      alert('✅ Story обновлена!');
    } else {
      alert('❌ Ошибка обновления Story');
    }
  }

  async function handleDeleteStory(storyId: number) {
    if (!confirm('Удалить эту Story?')) return;

    const result = await deleteStory(userId, storyId);
    if (result) {
      await loadStories();
      alert('✅ Story удалена!');
    } else {
      alert('❌ Ошибка удаления Story');
    }
  }

  async function handleToggleActive(story: Story) {
    const result = await updateStory(userId, story.id, { is_active: !story.is_active });
    if (result) {
      await loadStories();
    }
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
        <div className="bg-gradient-to-br from-red-900/90 to-red-950/90 rounded-2xl p-8 max-w-md w-full border border-red-500/30">
          <h2 className="text-2xl font-bold text-red-400 mb-4">❌ Доступ запрещен</h2>
          <p className="text-gray-300 mb-6">У вас нет прав администратора</p>
          <button
            onClick={onClose}
            className="w-full py-3 bg-red-600 hover:bg-red-700 rounded-xl font-semibold transition-colors"
          >
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen p-4 flex items-start justify-center pt-20">
        <div className="bg-gradient-to-br from-[#0b1220]/95 via-[#1a1640]/95 to-[#2b0f4f]/95 rounded-2xl max-w-2xl w-full border border-cyan-500/30 shadow-2xl">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-cyan-500/30">
            <h2 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">
              🛠 Админ-панель Stories
            </h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-6">
            {/* Create Story Button */}
            <button
              onClick={() => setShowCreateForm(!showCreateForm)}
              className="w-full py-4 bg-gradient-to-r from-cyan-600 to-purple-600 hover:from-cyan-500 hover:to-purple-500 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-5 h-5" />
              {showCreateForm ? 'Отменить' : 'Создать Story'}
            </button>

            {/* Create Form */}
            {showCreateForm && (
              <div className="bg-white/5 rounded-xl p-6 space-y-4 border border-cyan-500/20">
                {/* Выбор слота */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-3">
                    📍 Выберите Story для заполнения
                  </label>
                  <div className="grid grid-cols-1 gap-3">
                    {[
                      { slot: 1, name: 'Работа в проекте', icon: '💼' },
                      { slot: 2, name: 'О нас', icon: '👥' },
                      { slot: 3, name: 'Медиа/Стафф', icon: '📸' }
                    ].map(({ slot, name, icon }) => (
                      <button
                        key={slot}
                        onClick={() => setSelectedSlot(slot)}
                        className={`p-4 rounded-lg font-semibold transition-all text-left ${
                          selectedSlot === slot
                            ? 'bg-gradient-to-r from-cyan-600 to-purple-600 text-white shadow-lg'
                            : 'bg-black/30 text-gray-300 hover:bg-black/50 border border-cyan-500/20'
                        }`}
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{icon}</span>
                          <div>
                            <div className="font-bold">{name}</div>
                            <div className="text-xs opacity-70">Слот {slot}</div>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Загрузка фото */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <ImageIcon className="w-4 h-4" />
                    Загрузить фото из галереи
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileSelect}
                    className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded-lg text-white file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-cyan-600 file:text-white hover:file:bg-cyan-700 file:cursor-pointer"
                  />
                  {previewUrl && (
                    <div className="mt-3">
                      <img 
                        src={previewUrl} 
                        alt="Preview" 
                        className="w-full max-w-xs h-48 object-cover rounded-lg border border-cyan-500/30"
                      />
                    </div>
                  )}
                </div>

                {/* Текст */}
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2 flex items-center gap-2">
                    <Type className="w-4 h-4" />
                    Текст Story (опционально)
                  </label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Добавьте текст к Story..."
                    rows={4}
                    className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded-lg focus:outline-none focus:border-cyan-500 text-white resize-none"
                  />
                  <p className="text-xs text-gray-400 mt-1">
                    💡 Можно создать Story только с фото, только с текстом, или с обоими
                  </p>
                </div>

                {/* Кнопка создания */}
                <button
                  onClick={handleCreateStory}
                  disabled={uploading}
                  className="w-full py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                >
                  {uploading ? (
                    <>
                      <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Загрузка...
                    </>
                  ) : (
                    <>
                      <Save className="w-5 h-5" />
                      Создать в слоте {selectedSlot}
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Stories List */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-cyan-400">
                📱 Активные Stories ({stories.length})
              </h3>

              {stories.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <p>Нет Stories</p>
                  <p className="text-sm mt-2">Создайте первую Story!</p>
                </div>
              ) : (
                stories.map((story) => (
                  <div
                    key={story.id}
                    className={`bg-white/5 rounded-xl p-4 border transition-all ${
                      story.is_active ? 'border-cyan-500/30' : 'border-gray-500/30 opacity-50'
                    }`}
                  >
                    {editingStory?.id === story.id ? (
                      <div className="space-y-3">
                        <textarea
                          defaultValue={story.caption || ''}
                          id={`caption-${story.id}`}
                          rows={3}
                          className="w-full px-4 py-3 bg-black/30 border border-cyan-500/30 rounded-lg focus:outline-none focus:border-cyan-500 text-white resize-none"
                        />
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              const textarea = document.getElementById(`caption-${story.id}`) as HTMLTextAreaElement;
                              handleUpdateStory(story.id, textarea.value);
                            }}
                            className="flex-1 py-2 bg-green-600 hover:bg-green-700 rounded-lg font-semibold transition-colors flex items-center justify-center gap-2"
                          >
                            <Save className="w-4 h-4" />
                            Сохранить
                          </button>
                          <button
                            onClick={() => setEditingStory(null)}
                            className="flex-1 py-2 bg-gray-600 hover:bg-gray-700 rounded-lg font-semibold transition-colors"
                          >
                            Отмена
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <p className="text-sm text-gray-400">ID: {story.id}</p>
                            <p className="text-xs text-gray-500 mt-1">
                              Порядок: {story.order_num} | {new Date(story.created_at).toLocaleDateString('ru')}
                            </p>
                          </div>
                          <div className="flex gap-2">
                            <button
                              onClick={() => setEditingStory(story)}
                              className="p-2 bg-blue-600/20 hover:bg-blue-600/40 rounded-lg transition-colors"
                              title="Редактировать"
                            >
                              <Edit2 className="w-4 h-4 text-blue-400" />
                            </button>
                            <button
                              onClick={() => handleDeleteStory(story.id)}
                              className="p-2 bg-red-600/20 hover:bg-red-600/40 rounded-lg transition-colors"
                              title="Удалить"
                            >
                              <Trash2 className="w-4 h-4 text-red-400" />
                            </button>
                          </div>
                        </div>

                        {story.caption && (
                          <p className="text-gray-300 mb-3 text-sm">{story.caption}</p>
                        )}

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleToggleActive(story)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                              story.is_active
                                ? 'bg-green-600/20 text-green-400 hover:bg-green-600/30'
                                : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                            }`}
                          >
                            {story.is_active ? '✅ Активна' : '❌ Неактивна'}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
