import { ArrowRight, Check, CircleAlert } from 'lucide-react';
import type { RelationshipResponse } from '../../../api/generated/types.gen';
import { generationLabel, isDistantAncestry, SUBTYPE_LABELS, TIME_LABELS, VALIDITY_LABELS } from './relationship-presentation';
import '../../../../styles/family-relation-list.css';

export function FamilyRelationshipSummary({ relation, heading = true }: { relation: RelationshipResponse; heading?: boolean }) {
  const Container = heading ? 'div' : 'span';
  const Pair = heading ? 'h3' : 'span';
  const subject = relation.subjectCharacterName || '주체 인물';
  const object = relation.objectCharacterName || '상대 인물';
  const distant = isDistantAncestry(relation.kind);
  const ancestry = distant || relation.kind === 'PARENT_OF' || relation.kind === 'CHILD_OF';
  const people = relation.kind === 'CHILD_OF' || relation.kind === 'DESCENDANT_OF'
    ? [{ name: object, endpoint: 'object' }, { name: subject, endpoint: 'subject' }]
    : [{ name: subject, endpoint: 'subject' }, { name: object, endpoint: 'object' }];
  const peerLabel = relation.kind === 'SPOUSE' ? '배우자' : relation.kind === 'SIBLING' ? '형제자매' : '가족';
  const valid = relation.validity === 'VALID';
  return <Container className="family-relation-summary">
    <Pair className="family-relation-summary__pair" data-kind={relation.kind}>
      {people.map((person, index) => <span key={person.endpoint} className="family-relation-summary__person"
        data-person={person.endpoint} data-role={distant ? (index === 0 ? 'ancestor' : 'descendant') : ancestry ? (index === 0 ? 'parent' : 'child') : 'peer'}>
        {ancestry && <span className="family-relation-summary__role">{distant ? index === 0 ? '조상' : '후손' : index === 0 ? '부모' : '자녀'}</span>}
        <strong className="family-relation-summary__name">{person.name}</strong>
      </span>)}
      <span className="family-relation-summary__connector">
        {ancestry ? <ArrowRight size={28} aria-hidden="true" /> : <span>{peerLabel}</span>}
      </span>
    </Pair>
    <span className="family-relation-summary__metadata">
      <span className="family-relation-summary__status" data-validity={relation.validity ?? 'UNKNOWN'}>
        {valid ? <Check size={13} aria-hidden="true" /> : <CircleAlert size={13} aria-hidden="true" />}
        {relation.validity ? VALIDITY_LABELS[relation.validity] : '상태 확인 필요'}
      </span>
      {!valid && <span className="family-relation-summary__record">관계 기록</span>}
    {(distant || relation.temporalScope && relation.temporalScope !== 'CURRENT' || relation.timeLabel || relation.subtype && relation.subtype !== 'UNSPECIFIED') &&
      <span className="family-relation-summary__qualifiers">
        {distant && <><span>{generationLabel(relation.generationGap)}</span><span>중간 계보 생략</span></>}
        {relation.temporalScope && relation.temporalScope !== 'CURRENT' && <span>{TIME_LABELS[relation.temporalScope]}</span>}
        {relation.timeLabel && <span>{relation.timeLabel}</span>}
        {relation.subtype && relation.subtype !== 'UNSPECIFIED' && <span>{SUBTYPE_LABELS[relation.subtype]}</span>}
      </span>}
    </span>
  </Container>;
}
