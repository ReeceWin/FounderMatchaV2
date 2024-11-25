# matches_collector.py

from firebase_admin import firestore
import datetime
import uuid


class MatchCollector:
    def __init__(self, db):
        self.db = db
        self.matches_ref = self.db.collection('matches')

    def create_match(self, founder_data, developer_data, match_scores, initiated_by):
        """Create a new match record in the matches collection"""

        match_id = str(uuid.uuid4())
        timestamp = datetime.datetime.utcnow()

        # Construct match document
        match_data = {
            'match_id': match_id,
            'timestamp': timestamp,
            'founder_id': founder_data.get('id'),
            'developer_id': developer_data.get('id'),
            'match_initiated_by': initiated_by,

            # Match scores
            'scores': {
                'total_score': match_scores.get('total_score'),
                'components': {
                    'skill_score': match_scores['components'].get('skill_score'),
                    'personality_score': match_scores['components'].get('personality_score'),
                    'background_score': match_scores['components'].get('background_score'),
                    'cultural_score': match_scores['components'].get('cultural_score')
                }
            },

            # Founder snapshot
            'founder_snapshot': {
                'name': founder_data.get('name'),
                'industries': founder_data.get('industries', []),
                'personality_results': founder_data.get('personalityResults', {}),
                'work_styles': founder_data.get('workStyles', []),
                'about': founder_data.get('about', ''),
                'long_description': founder_data.get('longDescription', ''),
                'skills_needed': self._extract_skills_needed(
                    founder_data.get('about', ''),
                    founder_data.get('longDescription', '')
                )
            },

            # Developer snapshot
            'developer_snapshot': {
                'name': developer_data.get('name'),
                'skills': developer_data.get('skills', []),
                'personality_results': developer_data.get('personalityResults', {}),
                'work_styles': developer_data.get('workStyles', []),
                'industries': developer_data.get('industries', []),
                'degrees': developer_data.get('degrees', []),
                'companies': developer_data.get('companies', [])
            },

            # Match status tracking
            'status': {
                'current': 'pending',
                'history': [{
                    'status': 'pending',
                    'timestamp': timestamp
                }]
            },

            # Success metrics (to be updated later)
            'success_metrics': {
                'response_time': None,
                'collaboration_duration': None,
                'success_rating': None
            }
        }

        # Store in Firestore
        try:
            self.matches_ref.document(match_id).set(match_data)
            return {
                'success': True,
                'match_id': match_id,
                'message': 'Match created successfully'
            }
        except Exception as e:
            return {
                'success': False,
                'error': str(e)
            }

    def _extract_skills_needed(self, about, long_description):
        """Extract skills needed from founder's descriptions using basic keyword matching"""
        # This is a basic implementation - could be enhanced with NLP
        common_skills = [
            'Full-Stack', 'Back-End', 'Front-End', 'DevOps', 'Cloud',
            'Python', 'JavaScript', 'React', 'Node.js', 'AWS',
            'Machine Learning', 'AI', 'Data Science', 'Mobile',
            'iOS', 'Android', 'UI/UX', 'Database', 'Security'
        ]

        text = f"{about} {long_description}".lower()
        found_skills = []

        for skill in common_skills:
            if skill.lower() in text:
                found_skills.append(skill)

        return found_skills

    def update_match_status(self, match_id, new_status):
        """Update the status of a match"""
        try:
            match_ref = self.matches_ref.document(match_id)
            match_doc = match_ref.get()

            if not match_doc.exists:
                return {'success': False, 'error': 'Match not found'}

            timestamp = datetime.datetime.utcnow()

            # Update status
            match_ref.update({
                'status.current': new_status,
                'status.history': firestore.ArrayUnion([{
                    'status': new_status,
                    'timestamp': timestamp
                }])
            })

            return {'success': True, 'message': f'Status updated to {new_status}'}
        except Exception as e:
            return {'success': False, 'error': str(e)}

    def get_match_history(self, user_id, role='any'):
        """Get match history for a user"""
        try:
            if role == 'founder':
                query = self.matches_ref.where('founder_id', '==', user_id)
            elif role == 'developer':
                query = self.matches_ref.where('developer_id', '==', user_id)
            else:
                # Get matches for either role
                founder_matches = self.matches_ref.where('founder_id', '==', user_id).stream()
                developer_matches = self.matches_ref.where('developer_id', '==', user_id).stream()
                return {
                    'success': True,
                    'matches': list(founder_matches) + list(developer_matches)
                }

            matches = list(query.stream())
            return {'success': True, 'matches': matches}
        except Exception as e:
            return {'success': False, 'error': str(e)}