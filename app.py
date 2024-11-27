# app.py
import logging
import os
import time
from datetime import datetime
from functools import wraps

import firebase_admin
from firebase_admin import credentials, firestore
from flask import Flask, render_template, jsonify, request

from models.calculate_matches import EnhancedMatcher

# Set up logging
logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)

app = Flask(__name__)


def initialize_firebase():
    """Initialize Firebase with retry logic"""
    max_attempts = 3
    attempt = 0

    while attempt < max_attempts:
        try:
            if not firebase_admin._apps:
                cred = credentials.Certificate('firebase-credentials.json')
                firebase_admin.initialize_app(cred)
            return firestore.client()
        except Exception as e:
            attempt += 1
            if attempt == max_attempts:
                logger.error(f"Failed to initialize Firebase after {max_attempts} attempts: {e}")
                raise
            logger.warning(f"Firebase initialization attempt {attempt} failed: {e}")
            time.sleep(2 ** attempt)


def retry_on_firebase_error(f):
    """Decorator to retry Firebase operations"""

    @wraps(f)
    def wrapper(*args, **kwargs):
        max_attempts = 3
        attempt = 0
        last_error = None

        while attempt < max_attempts:
            try:
                return f(*args, **kwargs)
            except Exception as e:
                attempt += 1
                last_error = e
                if attempt == max_attempts:
                    logger.error(f"Operation failed after {max_attempts} attempts: {e}")
                    if 'get_developer_profile' in f.__name__:
                        return {
                            'id': 'default',
                            'name': 'Profile Temporarily Unavailable',
                            'role': 'Developer',
                            'skills': [],
                            'profileImageUrl': 'images/profiles/default-profile.png',
                            'personalityResults': {}
                        }
                    return None
                logger.warning(f"Operation attempt {attempt} failed: {e}")
                time.sleep(2 ** attempt)
        return None

    return wrapper


# Initialize Firebase with retry logic
try:
    db = initialize_firebase()
    matcher = EnhancedMatcher('firebase-credentials.json')
except Exception as e:
    logger.error(f"Fatal error initializing Firebase: {e}")
    db = None
    matcher = None


def get_local_image_path(profileImageUrl):
    """Convert database profileImageUrl to local static path or return default image"""

    if not profileImageUrl:
        logger.debug("No profile URL provided, returning default")
        return '/static/images/profiles/default-profile.png'

    # Get the file system path by joining static folder with 'images' and the profileImageUrl
    fs_path = os.path.join(
        app.static_folder,
        'images',
        profileImageUrl
    )

    fs_path = fs_path.replace('\\', '/')

    url_path = f'/static/images/{profileImageUrl}'
    url_path = url_path.replace('//', '/')

    if os.path.isfile(fs_path):
        return url_path
    else:
        logger.debug(f"File NOT found at {fs_path}")
        logger.debug(f"Attempted to find file at: {fs_path}")
        return '/static/images/profiles/default-profile.png'

@app.route('/')
def index():
    try:
        # Get initial profiles from database without passing IDs
        initial_founder = get_founder_profile()
        logger.debug(f"Initial founder data: {initial_founder}")

        initial_developer = get_developer_profile()
        logger.debug(f"Initial developer data: {initial_developer}")

        if not initial_founder or not initial_developer:
            logger.error("Could not fetch initial profiles")
            return "Error: Could not fetch profiles", 500

        initial_data = {
            'developer': initial_developer,
            'founder': initial_founder,
            'match_score': 0,
            'skills_score': 0,
            'personality_score': 0,
            'background_score': 0,
            'cultural_score': 0
        }

        return render_template('index.html', **initial_data)
    except Exception as e:
        logger.error(f"Error in index route: {e}", exc_info=True)
        return "An error occurred", 500


@retry_on_firebase_error
def get_founder_profile(founder_id=None):
    try:
        founders_ref = db.collection('hackathonusers')

        if founder_id:
            # Convert ID to string if it's not already
            founder_id = str(founder_id)
            # Get specific founder
            founder_doc = founders_ref.document(founder_id).get()
            if not founder_doc.exists:
                logger.warning(f"No founder found with ID: {founder_id}")
                return None
            founder_data = founder_doc.to_dict()
            if founder_data.get('role') != 'founder / entrepreneur':
                logger.warning(f"Invalid founder ID, wrong role: {founder_id}")
                return None
        else:
            # Get first founder (original behavior)
            query = founders_ref.where('role', '==', 'founder / entrepreneur').limit(1)
            docs = list(query.stream())
            if not docs:
                logger.warning("No founder found in database")
                return None
            founder_doc = docs[0]
            founder_data = founder_doc.to_dict()

        profile_image = founder_data.get('profileImageUrl')
        local_image_path = get_local_image_path(profile_image)

        return {
            'id': founder_doc.id,
            'name': founder_data.get('name', 'Unknown Founder'),
            'about': founder_data.get('about', ''),
            'longDescription': founder_data.get('longDescription', ''),
            'industries': founder_data.get('industries', []),
            'profileImageUrl': local_image_path,
            'personalityResults': founder_data.get('personalityResults', {}),
            'degrees': founder_data.get('degrees', []),
            'companies': founder_data.get('companies', []),
            'admiringpersonalities': founder_data.get('admiringpersonalities', []),
            'hobbies': founder_data.get('hobbies', []),
            'workStyles': founder_data.get('workStyles', []),
            'city': founder_data.get('city', ''),
            'skills': founder_data.get('skills', [])
        }

    except Exception as e:
        logger.error(f"Error fetching founder profile: {e}")
        return None

@app.route('/api/founders/<founder_id>', methods=['GET'])
@retry_on_firebase_error
def get_founder(founder_id):
    try:
        founder = get_founder_profile(founder_id)
        if not founder:
            return jsonify({'error': 'Founder not found'}), 404
        return jsonify(founder)
    except Exception as e:
        logger.error(f"Error in founder endpoint: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/founders', methods=['GET'])
@retry_on_firebase_error
def get_founders():
    try:
        founders_ref = db.collection('hackathonusers')
        query = founders_ref.where('role', '==', 'founder / entrepreneur').limit(10)

        founders = []
        for doc in query.stream():
            founder_data = doc.to_dict()
            profileImageUrl = founder_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            founders.append({
                'id': doc.id,
                'name': founder_data.get('name', 'Unknown Founder'),
                'profileImageUrl': local_image_path
            })

        return jsonify(founders)
    except Exception as e:
        logger.error(f"Error fetching founders: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@retry_on_firebase_error
def get_developer_profile(developer_id=None):
    try:
        devs_ref = db.collection('hackathonusers')

        if developer_id:
            # Convert ID to string if it's not already
            developer_id = str(developer_id)
            # Get specific developer
            dev_doc = devs_ref.document(developer_id).get()
            if not dev_doc.exists:
                logger.warning(f"No developer found with ID: {developer_id}")
                return None
            dev_data = dev_doc.to_dict()
            if dev_data.get('role') != 'softwareEngineer':
                logger.warning(f"Invalid developer ID, wrong role: {developer_id}")
                return None
        else:
            # Get first developer (original behavior)
            query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)
            docs = list(query.stream())
            if not docs:
                logger.warning("No developer found in database")
                return None
            dev_doc = docs[0]
            dev_data = dev_doc.to_dict()

        profileImageUrl = dev_data.get('profileImageUrl')
        local_image_path = get_local_image_path(profileImageUrl)

        # Add workStyles to the response
        return {
            'id': dev_doc.id,
            'about': dev_data.get('about', ''),
            'name': dev_data.get('name', 'Unknown Developer'),
            'role': dev_data.get('role', 'Developer'),
            'skills': dev_data.get('skills', []),
            'workStyles': dev_data.get('workStyles', []),  # Added this line
            'profileImageUrl': local_image_path,
            'personalityResults': dev_data.get('personalityResults', {}),
            'city': dev_data.get('city', ''),
            'degrees': dev_data.get('degrees', []),
            'industries': dev_data.get('industries', []),
            'companies': dev_data.get('companies', []),
            'admiringpersonalities': dev_data.get('admiringpersonalities', []),
            'hobbies': dev_data.get('hobbies', [])
        }

    except Exception as e:
        logger.error(f"Error fetching developer profile: {e}", exc_info=True)
        return None

@app.route('/api/developers/<developer_id>', methods=['GET'])
@retry_on_firebase_error
def get_developer(developer_id):
    try:
        developer = get_developer_profile(developer_id)
        if not developer:
            return jsonify({'error': 'Developer not found'}), 404
        return jsonify(developer)
    except Exception as e:
        logger.error(f"Error in developer endpoint: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500



@app.route('/api/match', methods=['POST'])
def match():
    try:
        founder_id = request.json.get('founder_id')
        developer_id = request.json.get('developer_id')

        logger.debug(f"Calculating match for founder_id: {founder_id}, developer_id: {developer_id}")

        # Get full profiles for both users
        founder = get_founder_profile(founder_id)
        developer = get_developer_profile(developer_id)

        logger.debug(f"Retrieved founder data: {founder}")
        logger.debug(f"Retrieved developer data: {developer}")

        if not founder or not developer:
            logger.error("Profile not found")
            return jsonify({'error': 'Profile not found'}), 404

        # Add necessary fields for matching algorithm
        founder_data = {
            'name': founder.get('name', ''),
            'about': founder.get('about', ''),
            'longDescription': founder.get('longDescription', ''),
            'industries': founder.get('industries', []),
            'role': 'founder / entrepreneur',
            'personalityResults': founder.get('personalityResults', {}),
            'degrees': founder.get('degrees', []),
            'companies': founder.get('companies', []),
            'admiringpersonalities': founder.get('admiringpersonalities', []),
            'hobbies': founder.get('hobbies', [])
        }

        developer_data = {
            'name': developer.get('name', ''),
            'about': developer.get('about', ''),
            'role': 'softwareEngineer',
            'skills': developer.get('skills', []),
            'personalityResults': developer.get('personalityResults', {}),
            'degrees': developer.get('degrees', []),
            'industries': developer.get('industries', []),
            'companies': developer.get('companies', []),
            'admiringpersonalities': developer.get('admiringpersonalities', []),
            'hobbies': developer.get('hobbies', [])
        }

        logger.debug(f"Prepared founder data for matcher: {founder_data}")
        logger.debug(f"Prepared developer data for matcher: {developer_data}")

        # Calculate match using EnhancedMatcher
        match_results = matcher.calculate_match_score(founder_data, developer_data)

        logger.debug(f"Match results: {match_results}")

        # Format the response for frontend
        response = {
            'total_score': match_results['total_score'],
            'components': {
                'skill_score': match_results['components']['skill_score'],
                'personality_score': match_results['components']['personality_score'],
                'background_score': match_results['components']['background_score'],
                'cultural_score': match_results['components']['cultural_score']
            }
        }

        logger.debug(f"Sending response: {response}")
        return jsonify(response)
    except Exception as e:
        logger.error(f"Error in match calculation: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/developers', methods=['GET'])
@retry_on_firebase_error
def get_developers():
    try:
        current_id = request.args.get('current_id')
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(10)

        if current_id:
            current_dev_ref = devs_ref.document(current_id)
            current_dev = current_dev_ref.get()
            if current_dev.exists:
                query = query.start_after(current_dev)

        developers = []
        for doc in query.stream():
            dev_data = doc.to_dict()
            logger.debug(f"Developer data from query: {dev_data}")

            profileImageUrl = dev_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            developers.append({
                'id': doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'workStyles': dev_data.get('workStyles', []),
                'profileImageUrl': local_image_path
            })

        return jsonify(developers)
    except Exception as e:
        logger.error(f"Error fetching developers: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/profiles/next', methods=['GET'])
@retry_on_firebase_error
def next_profile():
    try:
        current_id = request.args.get('current_id')
        logger.debug(f"Fetching next profile after ID: {current_id}")

        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)

        if current_id:
            current_dev_ref = devs_ref.document(current_id)
            current_dev = current_dev_ref.get()
            if current_dev.exists:
                query = query.start_after(current_dev)

        developers = list(query.stream())

        if not developers:
            logger.debug("No next developer found, wrapping to start")
            query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)
            developers = list(query.stream())

        if developers:
            dev_doc = developers[0]
            dev_data = dev_doc.to_dict()
            logger.debug(f"Found next developer: {dev_doc.id}")

            response_data = {
                'id': dev_doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'workStyles': dev_data.get('workStyles', []),
                'profileImageUrl': get_local_image_path(dev_data.get('profileImageUrl')),
                'personalityResults': dev_data.get('personalityResults', {}),
                'degrees': dev_data.get('degrees', []),
                'industries': dev_data.get('industries', []),
                'companies': dev_data.get('companies', []),
                'admiringpersonalities': dev_data.get('admiringpersonalities', []),
                'hobbies': dev_data.get('hobbies', [])
            }
            logger.debug(f"Sending response: {response_data}")
            return jsonify(response_data)

        logger.error("No developers found in database")
        return jsonify({'error': 'No developers found'}), 404
    except Exception as e:
        logger.error(f"Error fetching next profile: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/profiles/previous', methods=['GET'])
@retry_on_firebase_error
def previous_profile():
    try:
        current_id = request.args.get('current_id')
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(1)

        if current_id:
            current_dev_ref = devs_ref.document(current_id)
            current_dev = current_dev_ref.get()
            if current_dev.exists:
                query = query.order_by('__name__', direction=firestore.Query.DESCENDING).start_after(current_dev)

        developers = list(query.stream())

        if not developers:
            # If no previous developer, wrap around to the last one
            query = devs_ref.where('role', '==', 'softwareEngineer').order_by('__name__',
                                                                              direction=firestore.Query.DESCENDING).limit(
                1)
            developers = list(query.stream())

        if developers:
            dev_doc = developers[0]
            dev_data = dev_doc.to_dict()
            profileImageUrl = dev_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profileImageUrl)

            return jsonify({
                'id': dev_doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'profileImageUrl': local_image_path
            })

        return jsonify({'error': 'No developers found'}), 404
    except Exception as e:
        logger.error(f"Error fetching previous profile: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/matches/check', methods=['GET'])
@retry_on_firebase_error
def check_existing_match():
    try:
        founder_id = request.args.get('founder_id')
        developer_id = request.args.get('developer_id')

        if not founder_id or not developer_id:
            return jsonify({'error': 'Missing required parameters'}), 400

        # Query for existing match
        matches = db.collection('matches').where('founder_id', '==', founder_id).where('developer_id', '==',
                                                                                       developer_id).limit(1).get()

        exists = len(list(matches)) > 0

        return jsonify({'exists': exists})

    except Exception as e:
        logger.error(f"Error checking existing match: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/matches/<match_id>', methods=['DELETE'])
@retry_on_firebase_error
def delete_match(match_id):
    try:
        # Get match reference
        match_ref = db.collection('matches').document(match_id)
        match = match_ref.get()

        if not match.exists:
            return jsonify({'error': 'Match not found'}), 404

        # Delete the match
        match_ref.delete()

        return jsonify({
            'success': True,
            'message': 'Match deleted successfully'
        })

    except Exception as e:
        logger.error(f"Error deleting match: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/profiles/all', methods=['GET'])
@retry_on_firebase_error
def get_all_sorted_profiles():
    try:
        # Get founder ID from query parameters if provided
        founder_id = request.args.get('founder_id')

        # Get the founder profile
        founder = get_founder_profile(founder_id)
        if not founder:
            return jsonify({'error': 'Founder profile not found'}), 404

        # Prepare founder data for matching
        founder_data = {
            'name': founder.get('name', ''),
            'about': founder.get('about', ''),
            'longDescription': founder.get('longDescription', ''),
            'industries': founder.get('industries', []),
            'role': 'founder / entrepreneur',
            'personalityResults': founder.get('personalityResults', {}),
            'degrees': founder.get('degrees', []),
            'companies': founder.get('companies', []),
            'admiringpersonalities': founder.get('admiringpersonalities', []),
            'hobbies': founder.get('hobbies', [])
        }

        # Get all developers
        devs_ref = db.collection('hackathonusers')
        query = devs_ref.where('role', '==', 'softwareEngineer').limit(100)  # Adjust limit as needed
        developers = list(query.stream())

        # Calculate matches and store results
        matched_developers = []

        for dev_doc in developers:
            dev_data = dev_doc.to_dict()
            developer = {
                'id': dev_doc.id,
                'name': dev_data.get('name', 'Unknown Developer'),
                'role': dev_data.get('role', 'Developer'),
                'skills': dev_data.get('skills', []),
                'workStyles': dev_data.get('workStyles', []),
                'city': dev_data.get('city', ''),
                'profileImageUrl': get_local_image_path(dev_data.get('profileImageUrl')),
                'personalityResults': dev_data.get('personalityResults', {}),
                'degrees': dev_data.get('degrees', []),
                'industries': dev_data.get('industries', []),
                'companies': dev_data.get('companies', []),
                'admiringpersonalities': dev_data.get('admiringpersonalities', []),
                'hobbies': dev_data.get('hobbies', [])
            }

            # Calculate match score
            match_results = matcher.calculate_match_score(founder_data, dev_data)
            developer['match_score'] = match_results
            matched_developers.append(developer)

        # Sort developers by total match score in descending order
        matched_developers.sort(key=lambda x: x['match_score']['total_score'], reverse=True)

        logger.debug(f"Returning {len(matched_developers)} sorted matches for founder {founder.get('name')}")
        return jsonify(matched_developers)

    except Exception as e:
        logger.error(f"Error getting sorted profiles: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/search/developers', methods=['GET'])
@retry_on_firebase_error
def search_developers():
    try:
        query = request.args.get('q', '').lower()
        logger.debug(f"Searching developers with query: {query}")

        devs_ref = db.collection('hackathonusers')
        all_devs = devs_ref.where('role', '==', 'softwareEngineer').stream()

        results = []
        for dev in all_devs:
            dev_data = dev.to_dict()
            name = dev_data.get('name', '').lower()
            skills = [skill.lower() for skill in dev_data.get('skills', [])]

            # Match on name or skills
            if (query in name) or any(query in skill for skill in skills):
                results.append({
                    'id': dev.id,
                    'name': dev_data.get('name', ''),
                    'role': dev_data.get('role', ''),
                    'skills': dev_data.get('skills', []),
                    'profileImageUrl': get_local_image_path(dev_data.get('profileImageUrl'))
                })

        return jsonify(results)
    except Exception as e:
        logger.error(f"Error in developer search: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500


@app.route('/api/search/founders', methods=['GET'])
@retry_on_firebase_error
def search_founders():
    try:
        query = request.args.get('q', '').lower()
        logger.debug(f"Searching founders with query: {query}")

        founders_ref = db.collection('hackathonusers')
        all_founders = founders_ref.where('role', '==', 'founder / entrepreneur').stream()

        results = []
        for founder in all_founders:
            founder_data = founder.to_dict()
            name = founder_data.get('name', '').lower()
            industries = [ind.lower() for ind in founder_data.get('industries', [])]

            # Match on name or industries
            if (query in name) or any(query in industry for industry in industries):
                results.append({
                    'id': founder.id,
                    'name': founder_data.get('name', ''),
                    'industries': founder_data.get('industries', []),
                    'profileImageUrl': get_local_image_path(founder_data.get('profileImageUrl'))
                })

        return jsonify(results)
    except Exception as e:
        logger.error(f"Error in founder search: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

'''MATCHES DATABASE SECTION'''


@app.route('/matches_dashboard')
def matches_dashboard():
    return render_template('matches_dashboard.html')


@app.route('/api/matches', methods=['GET'])
@retry_on_firebase_error
def get_matches():
    try:
        matches_ref = db.collection('matches').order_by('created_at', direction=firestore.Query.DESCENDING).limit(50)
        matches = list(matches_ref.stream())

        # Convert to list of dictionaries
        matches_data = []
        stats = {'total': 0, 'successful': 0, 'pending': 0, 'failed': 0}

        for match in matches:
            match_dict = match.to_dict()
            match_dict['id'] = match.id
            matches_data.append(match_dict)

            # Update stats
            stats['total'] += 1
            stats[match_dict['status']] += 1

        return jsonify({
            'matches': matches_data,
            'stats': stats
        })

    except Exception as e:
        logger.error(f"Error fetching matches: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/matches/store', methods=['POST'])
@retry_on_firebase_error
def store_match():
    try:
        data = request.json
        match_ref = db.collection('matches').document()

        # Get full profiles for snapshot
        founder = get_founder_profile(data['founder_id'])
        developer = get_developer_profile(data['developer_id'])

        match_data = {
            'founder_id': data['founder_id'],
            'developer_id': data['developer_id'],
            'created_at': datetime.utcnow().isoformat(),
            'updated_at': datetime.utcnow().isoformat(),
            'status': 'pending',
            'status_history': [{
                'status': 'pending',
                'timestamp': datetime.utcnow().isoformat(),
                'updated_by': data['founder_id']
            }],

            'match_scores': {
                'total_score': data['match_scores']['total_score'],
                'components': {
                    'skill_score': data['match_scores']['components']['skill_score'],
                    'personality_score': data['match_scores']['components']['personality_score'],
                    'background_score': data['match_scores']['components']['background_score'],
                    'cultural_score': data['match_scores']['components']['cultural_score']
                }
            },

            'ml_features': {
                'location_match': get_location_match(data['founder_id'], data['developer_id']),
                'industry_overlap': get_industry_overlap(data['founder_id'], data['developer_id']),
                'skill_coverage': calculate_skill_coverage(founder, developer),
                'personality_compatibility': calculate_personality_compatibility(founder, developer),
                'experience_level_match': calculate_experience_match(founder, developer),
                'prior_matches': {
                    'founder': get_user_match_count(data['founder_id']),
                    'developer': get_user_match_count(data['developer_id']),
                    'success_rate_founder': get_success_rate(data['founder_id']),
                    'success_rate_developer': get_success_rate(data['developer_id'])
                }
            },

            # Profile snapshots
            'profile_snapshots': {
                'founder': {
                    'name': founder.get('name'),
                    'skills': founder.get('skills'),
                    'industries': founder.get('industries', []),
                    'about': founder.get('about', ''),
                    'personality_results': founder.get('personalityResults', {}),
                    'degrees': founder.get('degrees', []),
                    'companies': founder.get('companies', []),
                    'city': founder.get('city', ''),
                    'work_styles': founder.get('workStyles', [])
                },
                'developer': {
                    'name': developer.get('name'),
                    'skills': developer.get('skills', []),
                    'industries': developer.get('industries', []),
                    'about': developer.get('about', []),
                    'personality_results': developer.get('personalityResults', {}),
                    'degrees': developer.get('degrees', []),
                    'companies': developer.get('companies', []),
                    'city': developer.get('city', ''),
                    'work_styles': developer.get('workStyles', []),
                }
            }
        }

        match_ref.set(match_data)
        return jsonify({'success': True, 'match_id': match_ref.id})

    except Exception as e:
        logger.error(f"Error storing match: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/matches/<match_id>/status', methods=['PUT'])
@retry_on_firebase_error
def update_match_status(match_id):
    try:
        data = request.json
        new_status = data['status']
        updater_id = data.get('updater_id')

        match_ref = db.collection('matches').document(match_id)
        match = match_ref.get()

        if not match.exists:
            return jsonify({'error': 'Match not found'}), 404

        match_data = match.to_dict()

        # Add new status to history
        status_update = {
            'status': new_status,
            'timestamp': datetime.utcnow().isoformat(),
            'updated_by': updater_id
        }

        match_ref.update({
            'status': new_status,
            'updated_at': datetime.utcnow().isoformat(),
            'status_history': firestore.ArrayUnion([status_update])
        })

        return jsonify({'success': True})

    except Exception as e:
        logger.error(f"Error updating match status: {e}")
        return jsonify({'error': str(e)}), 500


def calculate_skill_coverage(founder, developer):
    founder_industries = set(founder.get('industries', []))
    developer_skills = set(developer.get('skills', []))
    return len(developer_skills) / max(len(founder_industries), 1)


def calculate_personality_compatibility(founder, developer):
    f_personality = founder.get('personalityResults', {})
    d_personality = developer.get('personalityResults', {})

    if not f_personality or not d_personality:
        return 0

    traits = ['openness', 'conscientiousness', 'extraversion', 'agreeableness', 'neuroticism']
    differences = []

    for trait in traits:
        f_score = f_personality.get(trait, 0)
        d_score = d_personality.get(trait, 0)
        differences.append(abs(f_score - d_score))

    return 1 - (sum(differences) / (len(traits) * 100)) if differences else 0


def calculate_experience_match(founder, developer):
    f_companies = len(founder.get('companies', []))
    d_companies = len(developer.get('companies', []))
    return 1 - abs(f_companies - d_companies) / max(f_companies + d_companies, 1)


def get_success_rate(user_id):
    matches = db.collection('matches').where('founder_id', '==', user_id).get()
    successful = 0
    total = 0

    for match in matches:
        total += 1
        if match.get('status') == 'successful':
            successful += 1

    return successful / total if total > 0 else 0


# Location matching
def get_location_match(founder_id, developer_id):
    """Returns 1 if locations match, 0 otherwise"""
    try:
        founder = get_founder_profile(founder_id)
        developer = get_developer_profile(developer_id)
        return 1 if founder.get('city') == developer.get('city') else 0
    except Exception as e:
        logger.error(f"Error in location matching: {e}")
        return 0


# Industry overlap calculation
def get_industry_overlap(founder_id, developer_id):
    """Calculate percentage of overlapping industries"""
    try:
        founder = get_founder_profile(founder_id)
        developer = get_developer_profile(developer_id)

        founder_industries = set(founder.get('industries', []))
        developer_industries = set(developer.get('industries', []))

        if not founder_industries or not developer_industries:
            return 0

        overlap = founder_industries.intersection(developer_industries)
        total = founder_industries.union(developer_industries)

        return len(overlap) / len(total)
    except Exception as e:
        logger.error(f"Error in industry overlap: {e}")
        return 0


# Match history tracking
def get_user_match_count(user_id):
    """Get total number of matches for a user"""
    try:
        matches = db.collection('matches').where('founder_id', '==', user_id).get()
        dev_matches = db.collection('matches').where('developer_id', '==', user_id).get()
        return len(list(matches)) + len(list(dev_matches))
    except Exception as e:
        logger.error(f"Error getting match count: {e}")
        return 0

"""INSIGHTS SECTION"""


@app.route('/insights')
def insights():
    return render_template('insights.html')

@app.route('/api/insights/metrics')
def get_insights_metrics():
    try:
        # Get all matches
        matches_ref = db.collection('matches').stream()
        matches = [match.to_dict() for match in matches_ref]

        # Calculate metrics
        total_matches = len(matches)
        successful_matches = sum(1 for m in matches if m.get('status') == 'successful')
        avg_score = sum(m.get('match_scores', {}).get('total_score', 0) for m in
                        matches) / total_matches if total_matches > 0 else 0

        return jsonify({
            'total_matches': total_matches,
            'successful_matches': successful_matches,
            'success_rate': (successful_matches / total_matches * 100) if total_matches > 0 else 0,
            'average_score': avg_score
        })
    except Exception as e:
        logger.error(f"Error getting insights metrics: {e}")
        return jsonify({'error': str(e)}), 500


@app.route('/api/insights/trends')
def get_insights_trends():
    try:
        matches_ref = db.collection('matches').order_by('created_at').stream()
        matches = [match.to_dict() for match in matches_ref]

        # Process daily data
        daily_data = {}
        for match in matches:
            date = datetime.fromisoformat(match['created_at']).strftime('%Y-%m-%d')

            if date not in daily_data:
                daily_data[date] = {
                    'total': 0,
                    'successful': 0,
                    'scores': []
                }

            daily_data[date]['total'] += 1

            total_score = match.get('match_scores', {}).get('total_score', 0)
            daily_data[date]['scores'].append(total_score)

            if match.get('status') == 'successful':
                daily_data[date]['successful'] += 1

        # Format data for frontend
        trends = []
        for date, data in daily_data.items():
            trends.append({
                'date': date,
                'total_matches': data['total'],
                'successful_matches': data['successful'],
                'average_score': sum(data['scores']) / len(data['scores']) if data['scores'] else 0,
                'individual_scores': data['scores']  # Include individual scores for distribution
            })

        return jsonify(trends)
    except Exception as e:
        print(f"Error getting insights trends: {e}")
        return jsonify({'error': str(e)}), 500

'''ALL USERS DATABASE NO MATCHES'''


@app.route('/user_database')
def user_database():
    return render_template('user_database.html')


@app.route('/api/all_users')
@retry_on_firebase_error
def get_all_users():
    try:
        # Get all users from the database
        users_ref = db.collection('hackathonusers')
        all_users = list(users_ref.stream())

        users_list = []
        for user in all_users:
            user_data = user.to_dict()
            profile_image = user_data.get('profileImageUrl')
            local_image_path = get_local_image_path(profile_image)

            users_list.append({
                'id': user.id,
                'name': user_data.get('name', 'Unknown'),
                'role': user_data.get('role', ''),
                'skills': user_data.get('skills', []),
                'industries': user_data.get('industries', []),
                'city': user_data.get('city', ''),
                'about': user_data.get('about', ''),
                'companies': user_data.get('companies', []),
                'degrees': user_data.get('degrees', []),
                'workStyles': user_data.get('workStyles', []),
                'profileImageUrl': local_image_path
            })

        return jsonify(users_list)
    except Exception as e:
        logger.error(f"Error fetching all users: {e}")
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True)