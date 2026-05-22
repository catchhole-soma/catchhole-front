import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { C } from './constants';
import {
  Share2, Copy, Mail, UserPlus, ExternalLink, CheckCheck,
  ChevronDown, X, Lock, LockOpen, Check, FileText, BookOpen,
  Scale, Scroll, Users,
} from 'lucide-react';

type CollabRole = 'PD' | '편집자' | '각색 작가' | '베타리더';
type CollabPerm = '전체 열람' | '설정 DB만' | '리포트만' | '댓글만';

interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: CollabRole;
  perm: CollabPerm;
  avatar: string;
  status: 'active' | 'pending';
}

const INIT_COLLABS: Collaborator[] = [
  { id: 'c1', name: '김편집', email: 'editor@naver.com',  role: '편집자',    perm: '전체 열람', avatar: '김', status: 'active'  },
  { id: 'c2', name: '박PD',  email: 'pd@kakao.com',       role: 'PD',        perm: '리포트만',  avatar: '박', status: 'active'  },
  { id: 'c3', name: '이각색', email: 'writer@gmail.com',  role: '각색 작가', perm: '설정 DB만', avatar: '이', status: 'pending' },
];

const ROLE_COLORS: Record<CollabRole, string> = {
  'PD':       '#4BB8D9',
  '편집자':   C.success,
  '각색 작가': C.warning,
  '베타리더': C.primary,
};

const PERM_DESC: Record<CollabPerm, string> = {
  '전체 열람': '설정 DB + 오류 리포트 + 타임라인 모두 열람',
  '설정 DB만': '캐릭터·세계관 설정집만 열람, 리포트 비공개',
  '리포트만':  '오류 리포트·충돌 목록만 열람, 설정 DB 비공개',
  '댓글만':    '댓글 작성만 가능, 내용 열람 불가',
};

function ShareItem({ item }: { item: { label: string; sub: string; defaultOn: boolean; color: string } }) {
  const [on, setOn] = useState(item.defaultOn);
  return (
    <div onClick={() => setOn(p => !p)} style={{
      display: 'flex', alignItems: 'center', gap: 12,
      padding: '10px 14px', borderRadius: 7, cursor: 'pointer',
      background: on ? item.color + '0A' : C.bg,
      border: `1px solid ${on ? item.color + '44' : C.border}`,
      transition: 'all 0.15s',
    }}>
      <div style={{
        width: 18, height: 18, borderRadius: 4, flexShrink: 0,
        background: on ? item.color : 'transparent',
        border: `2px solid ${on ? item.color : C.border}`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.15s',
      }}>
        {on && <Check size={11} color="#fff" />}
      </div>
      <div style={{ flex: 1 }}>
        <div style={{ color: on ? C.t1 : C.t2, fontSize: 13, fontWeight: on ? 600 : 400 }}>{item.label}</div>
        <div style={{ color: C.t3, fontSize: 11, marginTop: 1 }}>{item.sub}</div>
      </div>
    </div>
  );
}

interface Props {
  workTitle: string;
  onClose: () => void;
  /** 기본으로 열릴 탭 — 리포트 화면에선 'export', 에디터에선 'link' */
  defaultTab?: 'collab' | 'link' | 'export';
}

export function ShareModal({ workTitle, onClose, defaultTab = 'collab' }: Props) {
  const [tab, setTab] = useState<'collab' | 'link' | 'export'>(defaultTab);
  const [collabs, setCollabs] = useState<Collaborator[]>(INIT_COLLABS);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollabRole>('편집자');
  const [invitePerm, setInvitePerm] = useState<CollabPerm>('전체 열람');
  const [roleOpen, setRoleOpen] = useState(false);
  const [permOpen, setPermOpen] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const [spoilerHidden, setSpoilerHidden] = useState(true);
  const [exportDone, setExportDone] = useState<string | null>(null);

  const handleInvite = () => {
    if (!inviteEmail.trim()) return;
    const newC: Collaborator = {
      id: 'c' + Date.now(),
      name: inviteEmail.split('@')[0],
      email: inviteEmail.trim(),
      role: inviteRole,
      perm: invitePerm,
      avatar: inviteEmail[0].toUpperCase(),
      status: 'pending',
    };
    setCollabs(prev => [...prev, newC]);
    setInviteEmail('');
  };

  const handleRemove = (id: string) => setCollabs(prev => prev.filter(c => c.id !== id));

  const handleCopyLink = () => {
    setLinkCopied(true);
    setTimeout(() => setLinkCopied(false), 2000);
  };

  const handleExport = (type: string) => {
    setExportDone(type);
    setTimeout(() => setExportDone(null), 2000);
  };

  const TABS: { id: 'collab' | 'link' | 'export'; label: string; icon: React.ReactNode }[] = [
    { id: 'collab', label: '협업자 관리', icon: <Users size={13} /> },
    { id: 'link',   label: '링크 공유',   icon: <ExternalLink size={13} /> },
    { id: 'export', label: '내보내기',    icon: <FileText size={13} /> },
  ];

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)',
        zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}
      onClick={onClose}
    >
      <motion.div
        initial={{ y: 28, opacity: 0, scale: 0.97 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 14, opacity: 0 }}
        transition={{ duration: 0.22, ease: 'easeOut' }}
        onClick={e => e.stopPropagation()}
        style={{
          width: 580, background: C.surface, borderRadius: 14,
          border: `1px solid ${C.border}`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', maxHeight: '88vh', overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '22px 24px 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7,
                  background: `linear-gradient(135deg, ${C.primary}, #B48BFF)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Share2 size={14} color="#fff" />
                </div>
                <span style={{ color: C.t1, fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>설정집 공유 및 협업</span>
              </div>
              <div style={{ color: C.t3, fontSize: 12, paddingLeft: 36 }}>
                <span style={{
                  background: C.primary + '18', color: C.primary,
                  padding: '1px 7px', borderRadius: 3, fontSize: 11, fontWeight: 600,
                  border: `1px solid ${C.primary}33`, marginRight: 6,
                }}>{workTitle}</span>
                설정집 · 오류 리포트 공유
              </div>
            </div>
            <button onClick={onClose} style={{
              width: 30, height: 30, borderRadius: 6, background: 'transparent',
              border: `1px solid ${C.border}`, color: C.t3, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}><X size={14} /></button>
          </div>

          {/* 탭 */}
          <div style={{ display: 'flex' }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                height: 36, padding: '0 16px', background: 'transparent',
                border: 'none', borderBottom: `2px solid ${tab === t.id ? C.primary : 'transparent'}`,
                color: tab === t.id ? C.primary : C.t3,
                fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                display: 'flex', alignItems: 'center', gap: 6,
              }}>{t.icon}{t.label}</button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px' }}>
          <AnimatePresence mode="wait">

            {/* 협업자 관리 탭 */}
            {tab === 'collab' && (
              <motion.div key="collab" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                {/* 초대 폼 */}
                <div style={{
                  background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`,
                  padding: '14px 16px', marginBottom: 18,
                }}>
                  <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>협업자 초대</div>
                  <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                    <input
                      value={inviteEmail}
                      onChange={e => setInviteEmail(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && handleInvite()}
                      placeholder="이메일 주소 입력"
                      style={{
                        flex: 1, height: 36, borderRadius: 6,
                        background: C.surface, border: `1px solid ${C.border}`,
                        color: C.t1, fontSize: 13, padding: '0 12px',
                        fontFamily: 'inherit', outline: 'none', boxSizing: 'border-box',
                      }}
                    />
                    {/* 역할 드롭다운 */}
                    <div style={{ position: 'relative' }}>
                      <button onClick={() => { setRoleOpen(p => !p); setPermOpen(false); }} style={{
                        height: 36, padding: '0 10px', borderRadius: 6,
                        background: C.surface, border: `1px solid ${C.border}`,
                        color: ROLE_COLORS[inviteRole], fontSize: 12, fontWeight: 600,
                        cursor: 'pointer', fontFamily: 'inherit',
                        display: 'flex', alignItems: 'center', gap: 5, whiteSpace: 'nowrap',
                      }}>{inviteRole} <ChevronDown size={11} /></button>
                      {roleOpen && (
                        <div style={{
                          position: 'absolute', top: 40, left: 0, zIndex: 10,
                          background: C.surface, border: `1px solid ${C.border}`,
                          borderRadius: 7, overflow: 'hidden', minWidth: 110,
                          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                        }}>
                          {(Object.keys(ROLE_COLORS) as CollabRole[]).map(r => (
                            <div key={r} onClick={() => { setInviteRole(r); setRoleOpen(false); }} style={{
                              padding: '8px 14px', cursor: 'pointer', fontSize: 13,
                              color: ROLE_COLORS[r],
                              background: inviteRole === r ? C.primary + '18' : 'transparent',
                            }}>{r}</div>
                          ))}
                        </div>
                      )}
                    </div>
                    <button onClick={handleInvite} style={{
                      height: 36, padding: '0 14px', borderRadius: 6, border: 'none',
                      background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
                      cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}><UserPlus size={13} />초대</button>
                  </div>

                  {/* 권한 선택 */}
                  <div style={{ position: 'relative' }}>
                    <div style={{ color: C.t3, fontSize: 11, marginBottom: 6 }}>공유 범위</div>
                    <button onClick={() => { setPermOpen(p => !p); setRoleOpen(false); }} style={{
                      width: '100%', height: 34, padding: '0 12px', borderRadius: 5,
                      background: C.surface, border: `1px solid ${C.border}`,
                      color: C.t1, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span>{invitePerm}</span>
                      <span style={{ color: C.t3, fontSize: 11, flex: 1, textAlign: 'right', marginRight: 8 }}>{PERM_DESC[invitePerm]}</span>
                      <ChevronDown size={11} color={C.t3} />
                    </button>
                    {permOpen && (
                      <div style={{
                        position: 'absolute', top: 58, left: 0, right: 0, zIndex: 10,
                        background: C.surface, border: `1px solid ${C.border}`,
                        borderRadius: 7, overflow: 'hidden',
                        boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                      }}>
                        {(Object.keys(PERM_DESC) as CollabPerm[]).map(p => (
                          <div key={p} onClick={() => { setInvitePerm(p); setPermOpen(false); }} style={{
                            padding: '9px 14px', cursor: 'pointer',
                            background: invitePerm === p ? C.primary + '14' : 'transparent',
                            borderBottom: `1px solid ${C.border}`,
                          }}>
                            <div style={{ color: invitePerm === p ? C.primary : C.t1, fontSize: 13, fontWeight: invitePerm === p ? 600 : 400 }}>{p}</div>
                            <div style={{ color: C.t3, fontSize: 11, marginTop: 2 }}>{PERM_DESC[p]}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 협업자 목록 */}
                <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>
                  현재 협업자 ({collabs.length}명)
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {collabs.map(c => (
                    <div key={c.id} style={{
                      display: 'flex', alignItems: 'center', gap: 12,
                      padding: '10px 14px', borderRadius: 8,
                      background: C.bg, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        width: 34, height: 34, borderRadius: '50%', flexShrink: 0,
                        background: `linear-gradient(135deg, ${ROLE_COLORS[c.role]}66, ${ROLE_COLORS[c.role]}33)`,
                        border: `1.5px solid ${ROLE_COLORS[c.role]}55`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: ROLE_COLORS[c.role], fontSize: 14, fontWeight: 700,
                      }}>{c.avatar}</div>

                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 2 }}>
                          <span style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>{c.name}</span>
                          <span style={{
                            padding: '1px 6px', borderRadius: 3, fontSize: 10, fontWeight: 600,
                            background: ROLE_COLORS[c.role] + '22', color: ROLE_COLORS[c.role],
                            border: `1px solid ${ROLE_COLORS[c.role]}44`,
                          }}>{c.role}</span>
                          {c.status === 'pending' && (
                            <span style={{
                              padding: '1px 6px', borderRadius: 3, fontSize: 10,
                              background: C.warning + '22', color: C.warning,
                              border: `1px solid ${C.warning}44`,
                            }}>초대 대기중</span>
                          )}
                        </div>
                        <div style={{ color: C.t3, fontSize: 11 }}>{c.email} · {c.perm}</div>
                      </div>

                      <div style={{
                        padding: '3px 9px', borderRadius: 4, flexShrink: 0,
                        background: C.surface, border: `1px solid ${C.border}`,
                        color: C.t2, fontSize: 11,
                      }}>{c.perm}</div>

                      <button onClick={() => handleRemove(c.id)} style={{
                        width: 26, height: 26, borderRadius: 5, background: 'transparent',
                        border: `1px solid ${C.border}`, color: C.t3,
                        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        flexShrink: 0, transition: 'all 0.13s',
                      }}
                        onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.danger; (e.currentTarget as HTMLButtonElement).style.color = C.danger; }}
                        onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.borderColor = C.border; (e.currentTarget as HTMLButtonElement).style.color = C.t3; }}
                      ><X size={11} /></button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

            {/* 링크 공유 탭 */}
            {tab === 'link' && (
              <motion.div key="link" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{
                  background: C.bg, borderRadius: 8, border: `1px solid ${C.border}`,
                  padding: '14px 16px', marginBottom: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div>
                      <div style={{ color: C.t1, fontSize: 13, fontWeight: 600, marginBottom: 3 }}>스포일러 보호</div>
                      <div style={{ color: C.t3, fontSize: 11 }}>링크로 접속한 협업자에게 스포일러 항목을 가릴지 설정합니다</div>
                    </div>
                    <button onClick={() => setSpoilerHidden(p => !p)} style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: spoilerHidden ? C.primary : C.border,
                      transition: 'background 0.2s', position: 'relative', flexShrink: 0,
                    }}>
                      <div style={{
                        position: 'absolute', top: 3, left: spoilerHidden ? 22 : 3,
                        width: 18, height: 18, borderRadius: '50%', background: '#fff',
                        transition: 'left 0.2s',
                      }} />
                    </button>
                  </div>
                  <div style={{
                    padding: '8px 12px', borderRadius: 6,
                    background: spoilerHidden ? C.primary + '0D' : C.border + '44',
                    border: `1px solid ${spoilerHidden ? C.primary + '33' : C.border}`,
                    color: spoilerHidden ? C.primary : C.t3, fontSize: 12,
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {spoilerHidden ? <Lock size={12} /> : <LockOpen size={12} />}
                    {spoilerHidden ? '스포일러 항목은 ●●●●로 가려져 공유됩니다' : '모든 설정 내용이 그대로 공개됩니다'}
                  </div>
                </div>

                <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 }}>공유할 항목 선택</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 7, marginBottom: 18 }}>
                  {[
                    { label: '캐릭터 설정집', sub: '5명의 캐릭터 · 외형·성격·관계 포함',       defaultOn: true,  color: C.primary },
                    { label: '세계관 설정',   sub: '지리·규칙·마법/기술 등 6개 카테고리',       defaultOn: true,  color: C.success },
                    { label: '타임라인',       sub: '14개 이벤트 · 순서·인과관계 포함',          defaultOn: false, color: '#4BB8D9' },
                    { label: '오류 리포트',    sub: '5건 충돌 감지 결과 · AI 수정 제안 포함',    defaultOn: true,  color: C.danger  },
                  ].map((item) => (
                    <ShareItem key={item.label} item={item} />
                  ))}
                </div>

                <div style={{ color: C.t3, fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 }}>공유 링크</div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                  <div style={{
                    flex: 1, height: 36, borderRadius: 6, padding: '0 12px',
                    background: C.bg, border: `1px solid ${C.border}`,
                    display: 'flex', alignItems: 'center',
                    color: C.t3, fontSize: 12, fontFamily: 'monospace', overflow: 'hidden',
                  }}>
                    catchhole.io/share/detective-novel-abc123
                  </div>
                  <button onClick={handleCopyLink} style={{
                    height: 36, padding: '0 14px', borderRadius: 6, border: 'none',
                    background: linkCopied ? C.success : C.primary,
                    color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.2s',
                    display: 'flex', alignItems: 'center', gap: 6,
                  }}>
                    {linkCopied ? <><CheckCheck size={13} />복사됨</> : <><Copy size={13} />링크 복사</>}
                  </button>
                </div>
                <button style={{
                  width: '100%', height: 36, borderRadius: 6,
                  background: 'transparent', border: `1px solid ${C.border}`,
                  color: C.t2, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                }}><Mail size={13} />이메일로 전송</button>
              </motion.div>
            )}

            {/* 내보내기 탭 */}
            {tab === 'export' && (
              <motion.div key="export" initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
                <div style={{ color: C.t3, fontSize: 12, marginBottom: 16 }}>
                  설정집과 오류 리포트를 파일로 내보내 출판사·편집자에게 전달하세요.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {[
                    { type: 'PDF 리포트',    icon: <FileText size={18} />, color: C.danger,  desc: '오류 충돌 목록 + AI 수정 제안 + 원문 인용 포함',                    tag: '편집자·PD 추천' },
                    { type: '설정집 PDF',    icon: <BookOpen size={18} />, color: C.primary, desc: '캐릭터·세계관·타임라인 전체 정리본 (스포일러 선택 가능)',            tag: '각색 작가 추천' },
                    { type: 'Excel 원본',    icon: <Scale size={18} />,    color: C.success, desc: '설정 항목 전체 스프레드시트 · 필터·정렬 가능',                      tag: '데이터 편집용'  },
                    { type: 'Markdown 문서', icon: <Scroll size={18} />,   color: '#4BB8D9', desc: 'Notion·Obsidian 등 마크다운 기반 툴에서 바로 열기 가능',           tag: '개인 아카이브'  },
                  ].map(item => (
                    <div key={item.type} style={{
                      display: 'flex', alignItems: 'center', gap: 14,
                      padding: '14px 16px', borderRadius: 8,
                      background: C.bg, border: `1px solid ${C.border}`,
                    }}>
                      <div style={{
                        width: 40, height: 40, borderRadius: 9, flexShrink: 0,
                        background: item.color + '18', border: `1px solid ${item.color}33`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center', color: item.color,
                      }}>{item.icon}</div>
                      <div style={{ flex: 1 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                          <span style={{ color: C.t1, fontSize: 13, fontWeight: 600 }}>{item.type}</span>
                          <span style={{
                            padding: '1px 6px', borderRadius: 3, fontSize: 10,
                            background: item.color + '18', color: item.color,
                            border: `1px solid ${item.color}33`,
                          }}>{item.tag}</span>
                        </div>
                        <div style={{ color: C.t3, fontSize: 11 }}>{item.desc}</div>
                      </div>
                      <button onClick={() => handleExport(item.type)} style={{
                        height: 32, padding: '0 14px', borderRadius: 5, flexShrink: 0,
                        background: exportDone === item.type ? C.success + '22' : item.color + '18',
                        border: `1px solid ${exportDone === item.type ? C.success + '44' : item.color + '44'}`,
                        color: exportDone === item.type ? C.success : item.color,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
                        transition: 'all 0.2s', display: 'flex', alignItems: 'center', gap: 5,
                      }}>
                        {exportDone === item.type ? <><CheckCheck size={12} />저장됨</> : '내보내기'}
                      </button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
}
