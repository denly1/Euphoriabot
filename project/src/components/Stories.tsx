import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';
import { getStories, Story as APIStory } from '../lib/api';

interface Story {
  id: number;
  slot_number: number;
  title: string;
  avatar: string;
  photo_url?: string;
  caption?: string;
}

const SLOT_INFO = {
  1: { name: 'Работа в проекте', icon: '💼' },
  2: { name: 'О НАС', icon: '👥' },
  3: { name: 'МЕДИА STAFF', icon: '📸' }
};

const STORY_DURATION = 15000;

export default function Stories() {
  const [stories, setStories] = useState<Story[]>([]);
  const [activeStoryIndex, setActiveStoryIndex] = useState<number | null>(null);
  const [progress, setProgress] = useState(0);
  const [touchStart, setTouchStart] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    loadStories();
  }, []);

  async function loadStories() {
    try {
      const apiStories = await getStories();
      // Создаем 3 слота, заполняя данными из API
      const slots: Story[] = [1, 2, 3].map(slotNum => {
        const apiStory = apiStories.find(s => s.slot_number === slotNum);
        const slotInfo = SLOT_INFO[slotNum as keyof typeof SLOT_INFO];
        
        return {
          id: apiStory?.id || slotNum,
          slot_number: slotNum,
          title: slotInfo.name,
          avatar: slotInfo.icon,
          photo_url: apiStory?.photo_url,
          caption: apiStory?.caption
        };
      });
      setStories(slots);
    } catch (error) {
      console.error('Failed to load stories:', error);
      // Показываем пустые слоты при ошибке
      const emptySlots: Story[] = [1, 2, 3].map(slotNum => {
        const slotInfo = SLOT_INFO[slotNum as keyof typeof SLOT_INFO];
        return {
          id: slotNum,
          slot_number: slotNum,
          title: slotInfo.name,
          avatar: slotInfo.icon
        };
      });
      setStories(emptySlots);
    }
  }

  const openStory = (index: number) => {
    setActiveStoryIndex(index);
    setProgress(0);
  };

  const closeStory = () => {
    setActiveStoryIndex(null);
    setProgress(0);
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const nextStory = () => {
    if (activeStoryIndex === null) return;

    if (activeStoryIndex < stories.length - 1) {
      setActiveStoryIndex(activeStoryIndex + 1);
      setProgress(0);
    } else {
      closeStory();
    }
  };

  const prevStory = () => {
    if (activeStoryIndex === null) return;

    if (activeStoryIndex > 0) {
      setActiveStoryIndex(activeStoryIndex - 1);
      setProgress(0);
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const touchEnd = e.changedTouches[0].clientX;
    const diff = touchStart - touchEnd;

    if (Math.abs(diff) > 50) {
      if (diff > 0) {
        nextStory();
      } else {
        prevStory();
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    const clickX = e.clientX;
    const screenWidth = window.innerWidth;

    if (clickX < screenWidth / 3) {
      prevStory();
    } else if (clickX > (screenWidth * 2) / 3) {
      nextStory();
    }
  };

  useEffect(() => {
    if (activeStoryIndex !== null) {
      setProgress(0);

      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }

      intervalRef.current = setInterval(() => {
        setProgress((prev) => {
          if (prev >= 100) {
            nextStory();
            return 0;
          }
          return prev + (100 / (STORY_DURATION / 50));
        });
      }, 50);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [activeStoryIndex]);

  const currentStory = activeStoryIndex !== null ? stories[activeStoryIndex] : null;

  return (
    <>
      <div className="flex gap-3 p-4 overflow-x-auto">
        {stories.map((story, index) => (
          <div
            key={story.id}
            onClick={() => openStory(index)}
            className="flex flex-col items-center gap-2 cursor-pointer flex-shrink-0"
          >
            <div className="w-20 h-20 rounded-full bg-gradient-to-tr from-cyan-500 to-fuchsia-500 p-1 flex items-center justify-center">
              <div className="w-full h-full rounded-full bg-gradient-to-br from-[#0b1220] via-[#1a1640] to-[#2b0f4f] border-2 border-black/40 flex items-center justify-center">
                <span className="text-4xl">{story.avatar}</span>
              </div>
            </div>
            <span className="text-xs text-white font-medium">{story.title}</span>
          </div>
        ))}
      </div>

      {activeStoryIndex !== null && currentStory && (
        <div
          className="fixed inset-0 z-50 bg-gradient-to-br from-[#0b1220] via-[#1a1640] to-[#2b0f4f]"
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          onClick={handleClick}
        >
          <div className="relative w-full h-full">
            <div className="absolute top-2 left-2 right-2 flex gap-1 z-10">
              {stories.map((_, index) => (
                <div key={index} className="flex-1 h-1 bg-white/30 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-white transition-all duration-100"
                    style={{
                      width: index < activeStoryIndex ? '100%' : index === activeStoryIndex ? `${progress}%` : '0%'
                    }}
                  />
                </div>
              ))}
            </div>

            <button
              onClick={(e) => {
                e.stopPropagation();
                closeStory();
              }}
              className="absolute top-4 right-4 z-20 text-white"
            >
              <X size={32} />
            </button>

            <div
              className={`w-full h-full flex flex-col items-center justify-center p-3 sm:p-4 text-white`}
            >
              <div
                className={`w-full max-w-md mx-auto`}
              >
                {currentStory.photo_url ? (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-xl mx-auto" style={{ maxWidth: '85vw' }}>
                    <img
                      src={`https://euphoria.publicvm.com/api${currentStory.photo_url}`}
                      alt={currentStory.title}
                      className="w-full h-auto object-cover"
                      loading="lazy"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = 'none';
                      }}
                    />
                  </div>
                ) : (
                  <div className="mb-4 rounded-2xl overflow-hidden border border-white/10 shadow-xl mx-auto bg-white/5 flex items-center justify-center" style={{ maxWidth: '85vw', height: '400px' }}>
                    <p className="text-white/40 text-center px-4">Нет фото</p>
                  </div>
                )}
                {currentStory.caption && (
                  <div className="bg-white/10 backdrop-blur-sm rounded-lg p-4 border border-white/20 shadow-lg">
                    <p className="text-base leading-relaxed text-white/95 whitespace-pre-wrap">
                      {currentStory.caption}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
