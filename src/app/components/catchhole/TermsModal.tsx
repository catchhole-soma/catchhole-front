import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { C } from './constants';

type TabId = 'terms' | 'privacy';

interface Props {
  onClose: () => void;
  initialTab?: TabId;
}

const TABS: { id: TabId; label: string }[] = [
  { id: 'terms', label: '이용약관' },
  { id: 'privacy', label: '개인정보 처리방침' },
];

const TERMS_CONTENT = [
  { title: '제1조 (목적)', body: '이 약관은 CatchHole(이하 "서비스")이 제공하는 웹소설 설정 충돌 분석 서비스의 이용 조건 및 절차, 이용자와 서비스 간의 권리·의무 및 책임사항을 규정함을 목적으로 합니다.' },
  { title: '제2조 (용어의 정의)', body: '"이용자"란 이 약관에 따라 서비스를 이용하는 회원을 말합니다. "콘텐츠"란 이용자가 서비스에 업로드한 원고, 설정 데이터 등 일체의 정보를 말합니다.' },
  { title: '제3조 (약관의 효력 및 변경)', body: '서비스는 이 약관의 내용을 이용자가 쉽게 알 수 있도록 서비스 초기화면에 게시합니다. 서비스는 필요한 경우 약관을 변경할 수 있으며, 변경 시 7일 전 공지합니다.' },
  { title: '제4조 (서비스의 제공)', body: '서비스는 AI 기반 설정 충돌 분석, 캐릭터/타임라인/세계관 데이터베이스 관리, 협업 기능 등을 제공합니다. 서비스는 연중무휴 24시간 제공을 원칙으로 하되, 시스템 점검 시 일시 중단될 수 있습니다.' },
  { title: '제5조 (저작권)', body: '이용자가 서비스에 업로드한 원고 및 설정 데이터의 저작권은 이용자에게 귀속됩니다. 서비스는 이용자의 콘텐츠를 서비스 제공 목적 외에 사용하지 않습니다.' },
];

const PRIVACY_CONTENT = [
  { title: '1. 수집하는 개인정보 항목', body: '서비스는 회원가입 시 이메일 주소, 이름(필명)을 수집합니다. 서비스 이용 과정에서 IP 주소, 쿠키, 서비스 이용 기록이 자동으로 생성·수집될 수 있습니다.' },
  { title: '2. 개인정보의 수집 및 이용 목적', body: '수집된 개인정보는 회원 관리, 서비스 제공, 고객 문의 응대, 서비스 개선을 위해 사용됩니다. 마케팅·광고 목적으로는 별도 동의 없이 사용하지 않습니다.' },
  { title: '3. 개인정보의 보유 및 이용 기간', body: '개인정보는 회원 탈퇴 시 즉시 파기합니다. 단, 관계 법령에 따라 보존이 필요한 경우 해당 기간 동안 보관합니다.' },
  { title: '4. 개인정보의 제3자 제공', body: '서비스는 이용자의 개인정보를 원칙적으로 외부에 제공하지 않습니다. 다만, 이용자의 동의가 있거나 법령에 의해 요구되는 경우는 예외로 합니다.' },
  { title: '5. 개인정보 보호 책임자', body: '개인정보 처리에 관한 문의는 아래 연락처로 하시기 바랍니다.\n이메일: privacy@catchhole.io' },
];

export function TermsModal({ onClose, initialTab = 'terms' }: Props) {
  const [tab, setTab] = useState<TabId>(initialTab);
  const content = tab === 'terms' ? TERMS_CONTENT : PRIVACY_CONTENT;

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
          width: 600, background: C.surface, borderRadius: 14,
          border: `1px solid ${C.border}`,
          boxShadow: '0 32px 80px rgba(0,0,0,0.7)',
          display: 'flex', flexDirection: 'column', maxHeight: '80vh', overflow: 'hidden',
        }}
      >
        {/* 헤더 */}
        <div style={{ padding: '20px 24px 0', borderBottom: `1px solid ${C.border}`, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
            <span style={{ color: C.t1, fontSize: 16, fontWeight: 700, letterSpacing: '-0.3px' }}>법적 고지</span>
            <button onClick={onClose} style={{
              background: 'none', border: 'none', cursor: 'pointer', color: C.t3,
              display: 'flex', padding: 4, borderRadius: 4,
            }}>
              <X size={16} />
            </button>
          </div>
          <div style={{ display: 'flex', gap: 0 }}>
            {TABS.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)} style={{
                padding: '8px 16px', background: 'none', border: 'none',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: tab === t.id ? 600 : 400,
                color: tab === t.id ? C.primary : C.t3,
                borderBottom: `2px solid ${tab === t.id ? C.primary : 'transparent'}`,
                transition: 'all 0.15s', marginBottom: -1,
              }}>
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* 본문 */}
        <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {content.map((section, i) => (
              <div key={i}>
                <div style={{ color: C.t1, fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                  {section.title}
                </div>
                <div style={{ color: C.t2, fontSize: 13, lineHeight: 1.7, whiteSpace: 'pre-line' }}>
                  {section.body}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 하단 */}
        <div style={{
          padding: '16px 24px', borderTop: `1px solid ${C.border}`,
          display: 'flex', justifyContent: 'flex-end', flexShrink: 0,
        }}>
          <button onClick={onClose} style={{
            height: 36, padding: '0 20px', borderRadius: 6, border: 'none',
            background: C.primary, color: '#fff', fontSize: 13, fontWeight: 600,
            cursor: 'pointer', fontFamily: 'inherit',
          }}>
            확인
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
