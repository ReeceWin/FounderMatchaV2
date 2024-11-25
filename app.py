# app.py
import math
from flask import Flask, render_template, jsonify, request, url_for
import firebase_admin
from firebase_admin import credentials, firestore
from models.calculate_matches import EnhancedMatcher
import logging
import os
from functools import wraps
import time
import uuid
from datetime import datetime, timedelta

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
            time.sleep(2 ** attempt)  # Exponential backoff


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
    logger.debug(f"Starting get_local_image_path with input: {profileImageUrl}")

    if not profileImageUrl:
        logger.debug("No profile URL provided, returning default")
        return '/static/images/profiles/default-profile.png'

    # Get the file system path by joining static folder with 'images' and the profileImageUrl
    fs_path = os.path.join(
        app.static_folder,
        'images',  # Add 'images' to the path
        profileImageUrl
    )

    # Clean up the path (replace backslashes with forward slashes)
    fs_path = fs_path.replace('\\', '/')

    # For the URL, we want /static/images/profiles/...
    url_path = f'/static/images/{profileImageUrl}'
    url_path = url_path.replace('//', '/')  # Clean up any double slashes

    logger.debug(f"Checking file system path: {fs_path}")
    logger.debug(f"URL path that will be returned: {url_path}")

    if os.path.isfile(fs_path):
        logger.debug(f"File exists at {fs_path}")
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
                'workStyles': dev_data.get('workStyles', []),  # Added this line
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

# Add these routes to your app.py

from models.matches_collector import MatchCollector

# Initialize the match collector
match_collector = MatchCollector(db)

@app.route('/api/matches/create', methods=['POST'])
@retry_on_firebase_error
def create_match():
    try:
        data = request.json
        founder_id = data.get('founder_id')
        developer_id = data.get('developer_id')
        match_scores = data.get('match_scores')
        initiated_by = data.get('initiated_by')

        # Get full profiles
        founder = get_founder_profile(founder_id)
        developer = get_developer_profile(developer_id)

        if not founder or not developer:
            return jsonify({'error': 'Could not fetch user profiles'}), 404

        # Create match record
        result = match_collector.create_match(
            founder,
            developer,
            match_scores,
            initiated_by
        )

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify({'error': result['error']}), 500

    except Exception as e:
        logger.error(f"Error creating match: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/matches/<match_id>/status', methods=['PUT'])
@retry_on_firebase_error
def update_match_status():
    try:
        data = request.json
        match_id = data.get('match_id')
        new_status = data.get('status')

        result = match_collector.update_match_status(match_id, new_status)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify({'error': result['error']}), 400

    except Exception as e:
        logger.error(f"Error updating match status: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/api/matches/history/<user_id>')
@retry_on_firebase_error
def get_user_matches(user_id):
    try:
        role = request.args.get('role', 'any')
        result = match_collector.get_match_history(user_id, role)

        if result['success']:
            return jsonify(result), 200
        else:
            return jsonify({'error': result['error']}), 400

    except Exception as e:
        logger.error(f"Error fetching match history: {e}", exc_info=True)
        return jsonify({'error': str(e)}), 500

@app.route('/matches/dashboard/')
def matches_dashboard():
    """
    Render the matches dashboard page
    """
    return render_template('matches/dashboard.html')


@app.route('/api/matches/store', methods=['POST'])
@retry_on_firebase_error
def store_match():
    """Store a new match in Firebase"""
    try:
        print("=== Starting store_match function ===")
        data = request.json
        print(f"Received data: {data}")

        # Generate match ID and timestamp
        match_id = str(uuid.uuid4())
        timestamp = firestore.SERVER_TIMESTAMP  # Use Firestore server timestamp
        print(f"Generated match_id: {match_id}")

        # Get profiles
        founder = get_founder_profile(data['founder_id'])
        developer = get_developer_profile(data['developer_id'])

        if not founder or not developer:
            print("Failed to retrieve profiles")
            return jsonify({
                'success': False,
                'error': 'Could not fetch user profiles'
            }), 404

        # Construct match data
        match_data = {
            'match_id': match_id,
            'timestamp': timestamp,  # This will be converted to Firestore timestamp
            'founder_id': str(data['founder_id']),
            'developer_id': str(data['developer_id']),
            'match_initiated_by': data.get('initiated_by'),

            'scores': {
                'total_score': float(data['match_scores'].get('total_score', 0)),
                'components': {
                    'skill_score': float(data['match_scores']['components'].get('skill_score', 0)),
                    'personality_score': float(data['match_scores']['components'].get('personality_score', 0)),
                    'background_score': float(data['match_scores']['components'].get('background_score', 0)),
                    'cultural_score': float(data['match_scores']['components'].get('cultural_score', 0))
                }
            },

            'founder_snapshot': {
                'name': founder.get('name'),
                'industries': founder.get('industries', []),
                'personality_results': founder.get('personalityResults', {}),
                'work_styles': founder.get('workStyles', []),
                'about': founder.get('about', '')
            },

            'developer_snapshot': {
                'name': developer.get('name'),
                'skills': developer.get('skills', []),
                'personality_results': developer.get('personalityResults', {}),
                'work_styles': developer.get('workStyles', []),
                'industries': developer.get('industries', [])
            },

            'status': {
                'current': 'pending',
                'history': [{
                    'status': 'pending',
                    'timestamp': timestamp,  # This will also be a Firestore timestamp
                    'updated_by': data.get('initiated_by')
                }]
            }
        }

        # Store in Firestore
        print("Attempting to store in Firestore...")
        matches_ref = db.collection('matches')
        matches_ref.document(match_id).set(match_data)
        print("Successfully stored in Firestore")

        return jsonify({
            'success': True,
            'match_id': match_id,
            'message': 'Match created successfully'
        })

    except Exception as e:
        print(f"Error in store_match: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


# Add to app.py

@app.route('/matches/dashboard')
def matches_dashboard():
    """Render the matches dashboard page"""
    try:
        # Get initial statistics
        matches_ref = db.collection('matches')
        matches = list(matches_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).stream())

        total_matches = len(matches)
        avg_score = sum(match.get('scores', {}).get('total_score', 0) for match in
                        [m.to_dict() for m in matches]) / total_matches if total_matches > 0 else 0

        return render_template(
            'matches/dashboard.html',
            total_matches=total_matches,
            avg_score=round(avg_score, 1)
        )
    except Exception as e:
        logger.error(f"Error loading dashboard: {e}")
        return render_template('matches/dashboard.html')


@app.route('/api/matches/stats')
def get_match_stats():
    """Get match statistics for the dashboard"""
    try:
        matches_ref = db.collection('matches')
        matches = [match.to_dict() for match in matches_ref.stream()]

        # Calculate statistics
        total_matches = len(matches)
        if total_matches == 0:
            return jsonify({
                'success': True,
                'stats': {
                    'total_matches': 0,
                    'avg_score': 0,
                    'active_matches': 0,
                    'success_rate': 0,
                    'score_distribution': [0, 0, 0, 0, 0],
                    'recent_matches': []
                }
            })

        # Basic stats
        avg_score = sum(match.get('scores', {}).get('total_score', 0) for match in matches) / total_matches
        active_matches = sum(1 for match in matches if match.get('status', {}).get('current') == 'active')

        # Score distribution
        score_ranges = [0] * 5  # 0-20, 21-40, 41-60, 61-80, 81-100
        for match in matches:
            score = match.get('scores', {}).get('total_score', 0)
            index = min(int(score // 20), 4)
            score_ranges[index] += 1

        # Get recent matches
        recent_matches = sorted(
            matches,
            key=lambda x: x.get('timestamp', 0),
            reverse=True
        )[:5]

        recent_matches_data = [{
            'id': match.get('match_id'),
            'founder_name': match.get('founder_snapshot', {}).get('name', 'Unknown'),
            'developer_name': match.get('developer_snapshot', {}).get('name', 'Unknown'),
            'score': match.get('scores', {}).get('total_score', 0),
            'status': match.get('status', {}).get('current', 'pending'),
            'timestamp': match.get('timestamp')
        } for match in recent_matches]

        return jsonify({
            'success': True,
            'stats': {
                'total_matches': total_matches,
                'avg_score': round(avg_score, 1),
                'active_matches': active_matches,
                'success_rate': round((active_matches / total_matches) * 100, 1),
                'score_distribution': score_ranges,
                'recent_matches': recent_matches_data
            }
        })

    except Exception as e:
        logger.error(f"Error getting match stats: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


@app.route('/api/matches/list')
def get_matches_list():
    """Get paginated list of matches"""
    try:
        page = int(request.args.get('page', 1))
        per_page = int(request.args.get('per_page', 10))
        status_filter = request.args.get('status')
        score_filter = request.args.get('min_score')
        date_filter = request.args.get('date_range')  # in days

        matches_ref = db.collection('matches')
        query = matches_ref.order_by('timestamp', direction=firestore.Query.DESCENDING)

        # Apply filters
        if status_filter and status_filter != 'all':
            query = query.where('status.current', '==', status_filter)

        if score_filter and score_filter != 'all':
            query = query.where('scores.total_score', '>=', float(score_filter))

        if date_filter and date_filter != 'all':
            cutoff = datetime.now() - timedelta(days=int(date_filter))
            query = query.where('timestamp', '>=', cutoff)

        # Get total count for pagination
        total_matches = len(list(query.stream()))
        total_pages = math.ceil(total_matches / per_page)

        # Get paginated results
        matches = query.limit(per_page).offset((page - 1) * per_page).stream()

        matches_data = []
        for match in matches:
            match_dict = match.to_dict()
            matches_data.append({
                'id': match_dict.get('match_id'),
                'timestamp': match_dict.get('timestamp'),
                'founder_name': match_dict.get('founder_snapshot', {}).get('name'),
                'developer_name': match_dict.get('developer_snapshot', {}).get('name'),
                'total_score': match_dict.get('scores', {}).get('total_score'),
                'status': match_dict.get('status', {}).get('current'),
                'components': match_dict.get('scores', {}).get('components', {})
            })

        return jsonify({
            'success': True,
            'matches': matches_data,
            'pagination': {
                'current_page': page,
                'total_pages': total_pages,
                'total_matches': total_matches,
                'per_page': per_page
            }
        })

    except Exception as e:
        logger.error(f"Error getting matches list: {e}")
        return jsonify({
            'success': False,
            'error': str(e)
        }), 500


if __name__ == '__main__':
    app.run(debug=True)